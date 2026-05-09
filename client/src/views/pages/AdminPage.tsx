import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCurrentUser } from '../../controllers/auth.controller';
import { getUsersByTenant, updateUserStatus } from '../../models/services/user.service';
import { getMatchHistory } from '../../models/services/match.service';
import { trackEvent, EventType } from '../../models/services/analytics.service';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '../../models/types/user.types';
import type { Match, MatchPlayer } from '../../models/types/match.types';

type PlatformStats = {
  totalUsers: number;
  activeRooms: number;
  racesToday: number;
};

const getStatusLabel = (isActive: boolean): string => {
  if (isActive) {
    return 'Active';
  }
  return 'Banned';
};

const getStatusBadgeClass = (isActive: boolean): string => {
  if (isActive) {
    return 'px-2 py-1 rounded text-xs font-medium bg-green-900 text-green-300';
  }
  return 'px-2 py-1 rounded text-xs font-medium bg-red-900 text-red-300';
};

const getBanButtonClass = (isActive: boolean): string => {
  if (isActive) {
    return 'px-3 py-1 rounded text-sm font-medium bg-red-700 hover:bg-red-600 text-white';
  }
  return 'px-3 py-1 rounded text-sm font-medium bg-green-700 hover:bg-green-600 text-white';
};

const getBanButtonLabel = (isActive: boolean): string => {
  if (isActive) {
    return 'Ban';
  }
  return 'Unban';
};

const getAdminAction = (isActive: boolean): string => {
  if (isActive) {
    return 'unban_user';
  }
  return 'ban_user';
};

const getRefreshLabel = (isRefreshing: boolean): string => {
  if (isRefreshing) {
    return 'Refreshing…';
  }
  return 'Refresh';
};

const getWinnerLabel = (winnerTeam: string | null): string => {
  if (winnerTeam !== null) {
    return `Team ${winnerTeam}`;
  }
  return '-';
};

const getFinishedAtLabel = (finishedAt: string | null): string => {
  if (finishedAt !== null) {
    return new Date(finishedAt).toLocaleString();
  }
  return '-';
};

const REFRESH_INTERVAL_MS = 20000;

export const AdminPage = (): React.ReactElement => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ totalUsers: 0, activeRooms: 0, racesToday: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const tenantIdRef = useRef<string>('');

  const loadData = useCallback(async (showRefreshing: boolean): Promise<void> => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      }

      const user = await getCurrentUser();

      if (user === null) {
        navigate('/login');
        return;
      }

      if (user.role !== 'admin') {
        navigate('/lobby');
        return;
      }

      if (currentUser === null) {
        setCurrentUser(user);
      }
      tenantIdRef.current = user.tenantId;

      const [allUsers, allMatches] = await Promise.all([
        getUsersByTenant(user.tenantId),
        getMatchHistory(user.tenantId),
      ]);

      setUsers(allUsers);
      setMatches(allMatches);

      const { count: activeRoomsCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenantId)
        .eq('status', 'active');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const racesToday = allMatches.filter((match) => {
        if (match.finishedAt === null) {
          return false;
        }
        return new Date(match.finishedAt) >= today;
      }).length;

      setStats({
        totalUsers: allUsers.length,
        activeRooms: activeRoomsCount ?? 0,
        racesToday,
      });
      setError(null);
    } catch (err) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else {
        message = 'Failed to load admin data';
      }
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate, currentUser]);

  // Initial load
  useEffect((): (() => void) => {
    const timer = setTimeout((): void => {
      void loadData(false);
    }, 0);
    return (): void => {
      clearTimeout(timer);
    };
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 20 s
  useEffect((): (() => void) => {
    const timer = setInterval((): void => {
      void loadData(false);
    }, REFRESH_INTERVAL_MS);
    return (): void => {
      clearInterval(timer);
    };
  }, [loadData]);

  // Supabase realtime: matches table
  useEffect((): (() => void) => {
    const channel = supabase
      .channel('admin_matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (): void => {
          void loadData(false);
        }
      )
      .subscribe();

    return (): void => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleToggleBan = async (targetUser: User): Promise<void> => {
    if (currentUser === null) {
      return;
    }

    try {
      const newStatus = !targetUser.isActive;
      await updateUserStatus(targetUser.id, newStatus);

      setUsers((prev) => {
        return prev.map((user) => {
          if (user.id === targetUser.id) {
            return { ...user, isActive: newStatus };
          }
          return user;
        });
      });

      trackEvent(EventType.ADMIN_ACTION, currentUser.id, currentUser.tenantId, {
        action: getAdminAction(newStatus),
        targetUserId: targetUser.id,
      });
    } catch (err) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else {
        message = 'Failed to update user';
      }
      setError(message);
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const renderMatchPlayers = (players: MatchPlayer[]): React.ReactElement => {
    if (players.length === 0) {
      return <span className="text-gray-500 text-sm italic">No player data</span>;
    }
    return (
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="pb-2 pr-6 text-gray-500">Pos</th>
            <th className="pb-2 pr-6 text-gray-500">Player</th>
            <th className="pb-2 pr-6 text-gray-500">Team</th>
            <th className="pb-2 pr-6 text-gray-500">Time</th>
            <th className="pb-2 pr-6 text-gray-500">🪙 Coins</th>
            <th className="pb-2 text-gray-500">Score</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p): React.ReactElement => {
            return (
              <tr key={p.id} className="border-b border-gray-800">
                <td className="py-2 pr-6 text-gray-300">{p.finishPosition ?? '-'}</td>
                <td className="py-2 pr-6 text-white">{p.username ?? p.userId.slice(0, 8)}</td>
                <td className="py-2 pr-6 text-gray-300">{p.team}</td>
                <td className="py-2 pr-6 text-gray-300 font-mono">
                  {p.finishTimeMs !== null && p.finishTimeMs > 0 ? formatTime(p.finishTimeMs) : '--:--'}
                </td>
                <td className="py-2 pr-6 text-yellow-400 font-semibold">{p.coinsCollected}</td>
                <td className="py-2 text-green-400 font-semibold">{p.score}pts</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <div className="flex gap-2">
            <button
              onClick={(): void => {
                void loadData(true);
              }}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-semibold rounded-lg"
            >
              {getRefreshLabel(refreshing)}
            </button>
            <Link
              to="/"
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg inline-flex items-center"
            >
              Home
            </Link>
            <button
              onClick={(): void => {
                navigate('/lobby');
              }}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
            >
              Play
            </button>
          </div>
        </div>

        {error !== null && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-blue-400">{stats.totalUsers}</div>
            <div className="text-gray-400 mt-1">Total Users</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-green-400">{stats.activeRooms}</div>
            <div className="text-gray-400 mt-1">Active Rooms</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-yellow-400">{stats.racesToday}</div>
            <div className="text-gray-400 mt-1">Races Today</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-medium">Username</th>
                  <th className="pb-3 text-gray-400 font-medium">Role</th>
                  <th className="pb-3 text-gray-400 font-medium">Status</th>
                  <th className="pb-3 text-gray-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  return (
                    <tr key={user.id} className="border-b border-gray-700">
                      <td className="py-3 text-white">{user.username}</td>
                      <td className="py-3 text-gray-300">{user.role}</td>
                      <td className="py-3">
                        <span className={getStatusBadgeClass(user.isActive)}>
                          {getStatusLabel(user.isActive)}
                        </span>
                      </td>
                      <td className="py-3">
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={(): void => {
                              void handleToggleBan(user);
                            }}
                            className={getBanButtonClass(user.isActive)}
                          >
                            {getBanButtonLabel(user.isActive)}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Match History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-3 text-gray-400 font-medium w-6" />
                  <th className="pb-3 text-gray-400 font-medium">Date &amp; Time</th>
                  <th className="pb-3 text-gray-400 font-medium">Status</th>
                  <th className="pb-3 text-gray-400 font-medium">🏆 Winner</th>
                  <th className="pb-3 text-gray-400 font-medium">Players</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match): React.ReactElement => {
                  const isExpanded = expandedMatch === match.id;
                  const winner = (match.players ?? []).find((p) => p.finishPosition === 1);
                  const winnerName = winner?.username ?? winner?.userId?.slice(0, 8) ?? '—';
                  const topCoins = (match.players ?? []).reduce((best, p) =>
                    p.coinsCollected > best.coins ? { name: p.username ?? p.userId.slice(0, 8), coins: p.coinsCollected } : best,
                    { name: '—', coins: 0 }
                  );
                  return (
                    <>
                      <tr
                        key={match.id}
                        className="border-b border-gray-700 cursor-pointer hover:bg-gray-750"
                        onClick={(): void => {
                          setExpandedMatch(isExpanded ? null : match.id);
                        }}
                      >
                        <td className="py-3 text-gray-500 text-xs">{isExpanded ? '▼' : '▶'}</td>
                        <td className="py-3 text-gray-300 text-sm">
                          {match.finishedAt !== null ? new Date(match.finishedAt).toLocaleString() : <span className="text-gray-600">In progress</span>}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${match.status === 'finished' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                            {match.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {winner !== undefined ? (
                            <span className="text-yellow-400 font-bold flex items-center gap-1">
                              🥇 {winnerName}
                              {topCoins.coins > 0 && (
                                <span className="ml-2 text-gray-400 text-xs font-normal">
                                  · top coins: <span className="text-yellow-300">{topCoins.name} ({topCoins.coins}🪙)</span>
                                </span>
                              )}
                            </span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="py-3 text-gray-400 text-sm">
                          {(match.players ?? []).length} player{(match.players ?? []).length !== 1 ? 's' : ''}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${match.id}-detail`} className="border-b border-gray-700 bg-gray-900">
                          <td colSpan={5} className="py-3 px-6">
                            {renderMatchPlayers(match.players ?? [])}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
