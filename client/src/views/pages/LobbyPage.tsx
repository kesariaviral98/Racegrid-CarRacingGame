import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleSelectTeam,
  handleLeaveRoom,
} from '../../controllers/room.controller';
import { getCurrentUser } from '../../controllers/auth.controller';
import type { Room, RoomPlayer, TeamId } from '../../models/types/room.types';
import type { User } from '../../models/types/user.types';

const CAR_COLOR_KEY = 'carColor';

const CAR_COLORS: { hex: string; name: string }[] = [
  { hex: '#cc1111', name: 'Red' },
  { hex: '#1155cc', name: 'Blue' },
  { hex: '#117733', name: 'Green' },
  { hex: '#cc8800', name: 'Orange' },
  { hex: '#7711cc', name: 'Purple' },
  { hex: '#cc1188', name: 'Pink' },
  { hex: '#cccccc', name: 'White' },
  { hex: '#222222', name: 'Black' },
];

const getStoredColor = (): string => {
  const stored = localStorage.getItem(CAR_COLOR_KEY);
  if (stored !== null) {
    return stored;
  }
  return '#cc1111';
};

const getColorBorder = (isSelected: boolean): string => {
  if (isSelected) {
    return '#ffffff';
  }
  return 'transparent';
};

const getColorTransform = (isSelected: boolean): string | undefined => {
  if (isSelected) {
    return 'scale(1.2)';
  }
  return undefined;
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Unknown error';
};

export const LobbyPage = (): React.ReactElement => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [carColor, setCarColor] = useState<string>(getStoredColor());

  const handleColorSelect = (hex: string): void => {
    setCarColor(hex);
    localStorage.setItem(CAR_COLOR_KEY, hex);
  };

  useEffect((): void => {
    const loadUser = async (): Promise<void> => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    };

    void loadUser();
  }, []);

  useEffect((): (() => void) => {
    if (room === null) {
      return (): void => {};
    }

    const roomId = room.id;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'broadcast',
        { event: 'players_update' },
        (payload: { payload: { players: RoomPlayer[] } }): void => {
          setPlayers(payload.payload.players);
        }
      )
      .on(
        'broadcast',
        { event: 'race_started' },
        (): void => {
          navigate(`/game/${roomId}`);
        }
      )
      .subscribe();

    return (): void => {
      void supabase.removeChannel(channel);
    };
  }, [room, navigate]);

  const broadcastPlayersUpdate = useCallback(
    async (updatedPlayers: RoomPlayer[], roomId: string): Promise<void> => {
      await supabase.channel(`room:${roomId}`).send({
        type: 'broadcast',
        event: 'players_update',
        payload: { players: updatedPlayers },
      });
    },
    []
  );

  const handleCreate = async (): Promise<void> => {
    if (user === null) {
      return;
    }

    try {
      setError(null);
      const newRoom = await handleCreateRoom(user.tenantId, user.id);
      setRoom(newRoom);
      const updatedPlayers = handleSelectTeam([], user.id, user.username, 'A', user.tenantId);
      setPlayers(updatedPlayers);
      await broadcastPlayersUpdate(updatedPlayers, newRoom.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleJoin = async (): Promise<void> => {
    if (user === null) {
      return;
    }

    try {
      setError(null);
      const joinedRoom = await handleJoinRoom(joinCode, user.id, user.tenantId);
      setRoom(joinedRoom);
      const updatedPlayers = handleSelectTeam(players, user.id, user.username, 'A', user.tenantId);
      setPlayers(updatedPlayers);
      await broadcastPlayersUpdate(updatedPlayers, joinedRoom.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleTeamSelect = async (team: TeamId): Promise<void> => {
    if (user === null || room === null) {
      return;
    }

    try {
      setError(null);
      const updatedPlayers = handleSelectTeam(
        players,
        user.id,
        user.username,
        team,
        user.tenantId
      );
      setPlayers(updatedPlayers);
      await broadcastPlayersUpdate(updatedPlayers, room.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleLeave = async (): Promise<void> => {
    if (user === null || room === null) {
      return;
    }

    const updatedPlayers = handleLeaveRoom(players, user.id);
    setPlayers(updatedPlayers);
    await broadcastPlayersUpdate(updatedPlayers, room.id);
    setRoom(null);
  };

  const handleStartRace = async (): Promise<void> => {
    if (room === null) {
      return;
    }

    await supabase.channel(`room:${room.id}`).send({
      type: 'broadcast',
      event: 'race_started',
      payload: { roomId: room.id },
    });

    navigate(`/game/${room.id}`);
  };

  const copyRoomCode = async (): Promise<void> => {
    if (room === null) {
      return;
    }

    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout((): void => {
      setCopied(false);
    }, 2000);
  };

  const getStartButtonLabel = (canStart: boolean): string => {
    if (canStart) {
      return 'Start Race';
    }
    return 'Need at least 1 player per team';
  };

  const getCopiedLabel = (isCopied: boolean): string => {
    if (isCopied) {
      return 'Copied!';
    }
    return 'Copy Code';
  };

  const renderTeamColumn = (teamId: TeamId, teamPlayers: RoomPlayer[]): React.ReactElement => {
    return (
      <div className="flex-1 bg-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">
          Team {teamId}
          <span className="ml-2 text-sm text-gray-400">({teamPlayers.length} players)</span>
          {user !== null && (
            <button
              onClick={(): void => {
                void handleTeamSelect(teamId);
              }}
              className="ml-2 text-sm bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded"
            >
              Join
            </button>
          )}
        </h3>
        <div className="space-y-2">
          {teamPlayers.map((player) => {
            return (
              <div key={player.userId} className="h-12 bg-gray-600 rounded-lg flex items-center px-3">
                <span className="text-white">{player.username}</span>
              </div>
            );
          })}
          {teamPlayers.length === 0 && (
            <div className="h-12 bg-gray-600 rounded-lg flex items-center px-3">
              <span className="text-gray-400 italic">No players yet</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const teamAPlayers = players.filter((player) => {
    return player.team === 'A';
  });
  const teamBPlayers = players.filter((player) => {
    return player.team === 'B';
  });
  const canStart =
    teamAPlayers.length >= 1 &&
    teamBPlayers.length >= 1 &&
    room !== null &&
    user !== null &&
    room.hostId === user.id;

  if (room === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Lobby</h1>
            <button
              onClick={(): void => { navigate('/'); }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg"
            >
              ← Home
            </button>
          </div>

          {error !== null && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <button
            onClick={(): void => {
              void handleCreate();
            }}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg mb-4"
          >
            Create Room
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                setJoinCode(e.target.value.toUpperCase());
              }}
              placeholder="Enter room code"
              maxLength={6}
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={(): void => {
                void handleJoin();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={(): void => { navigate('/'); }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg"
            >
              ← Home
            </button>
            <h1 className="text-2xl font-bold text-white">Room Lobby</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-mono text-lg">{room.code}</span>
            <button
              onClick={(): void => {
                void copyRoomCode();
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
            >
              {getCopiedLabel(copied)}
            </button>
          </div>
        </div>

        {error !== null && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-4 mb-6">
          {renderTeamColumn('A', teamAPlayers)}
          <div className="flex items-center text-gray-400 text-2xl font-bold">VS</div>
          {renderTeamColumn('B', teamBPlayers)}
        </div>

        {/* Car colour picker */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="text-sm text-gray-400 mb-2 font-medium">Your Car Colour</div>
          <div className="flex gap-2 flex-wrap">
            {CAR_COLORS.map((c): React.ReactElement => {
              const isSelected = c.hex === carColor;
              return (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={(): void => { handleColorSelect(c.hex); }}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.hex,
                    borderColor: getColorBorder(isSelected),
                    transform: getColorTransform(isSelected),
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={(): void => { void handleLeave(); }}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Leave
          </button>
          <button
            onClick={(): void => { void handleStartRace(); }}
            disabled={room === null || user === null || room.hostId !== user.id || players.length === 0}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
            title="Race alone against a Bot"
          >
            Solo vs Bot
          </button>
          <button
            onClick={(): void => { void handleStartRace(); }}
            disabled={!canStart}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
          >
            {getStartButtonLabel(canStart)}
          </button>
        </div>
      </div>
    </div>
  );
};
