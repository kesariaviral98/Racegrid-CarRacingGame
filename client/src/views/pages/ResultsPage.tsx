import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getMatchHistory } from '../../models/services/match.service';
import { getCurrentUser } from '../../controllers/auth.controller';
import type { RaceResultWs } from '../../controllers/websocket.controller';

type LocationState = { results?: RaceResultWs[] };

const formatTime = (ms: number): string => {
  if (ms <= 0) return '--:--.--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

const MEDAL = ['🥇', '🥈', '🥉'];
const POS_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32', '#9ca3af'];
const POS_BG = [
  'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(180,130,0,0.12))',
  'linear-gradient(135deg, rgba(192,192,192,0.15), rgba(120,120,120,0.10))',
  'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(130,80,30,0.10))',
];
const POS_BORDER = ['rgba(255,215,0,0.4)', 'rgba(192,192,192,0.3)', 'rgba(205,127,50,0.3)'];

const RESULTS_CSS = `
@keyframes slide-in {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

export const ResultsPage = (): React.ReactElement => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const [results, setResults] = useState<RaceResultWs[]>(() => {
    if (locationState?.results && locationState.results.length > 0) return locationState.results;
    try {
      const stored = sessionStorage.getItem('raceResults');
      if (stored) return JSON.parse(stored) as RaceResultWs[];
    } catch { /* ignore */ }
    return [];
  });
  const [loading, setLoading] = useState(results.length === 0);

  useEffect((): void => {
    if (results.length > 0) { return; }

    const loadFallback = async (): Promise<void> => {
      try {
        const user = await getCurrentUser();
        if (user === null) { navigate('/'); return; }
        const matches = await getMatchHistory(user.tenantId);
        const match = matches.find((m) => m.roomId === roomId);
        if (match?.players !== undefined && match.players.length > 0) {
          setResults(match.players as unknown as RaceResultWs[]);
        }
      } catch (err) {
        console.error('Failed to load results:', err);
      } finally {
        setLoading(false);
      }
    };

    void loadFallback();
  }, [roomId, navigate, results.length]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#9ca3af', fontSize: 18 }}>Loading results…</div>
      </div>
    );
  }

  const winner = results.find((r) => r.finishPosition === 1);

  return (
    <div style={pageStyle}>
      <style>{RESULTS_CSS}</style>

      <div style={{ width: '100%', maxWidth: 540, animation: 'slide-in 0.5s ease-out' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 8 }}>🏁</div>
          <h1 style={{
            fontSize: 42, fontWeight: 900, margin: '0 0 8px',
            fontFamily: 'Impact, Arial Black, sans-serif', letterSpacing: 4,
            background: 'linear-gradient(180deg, #fff 0%, #aac4ff 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            RACE OVER
          </h1>
          {winner !== undefined && (
            <p style={{ color: '#ffd700', fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: 1 }}>
              🏆 {winner.username} takes the win!
            </p>
          )}
        </div>

        {/* Results table */}
        {results.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {results.map((r, idx): React.ReactElement => {
              const pos = r.finishPosition - 1;
              const isTop3 = pos < 3;
              return (
                <div key={r.userId} style={{
                  background: isTop3 ? POS_BG[pos] : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isTop3 ? POS_BORDER[pos] : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14, padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  animation: `slide-in 0.4s ease-out ${idx * 0.08}s both`,
                }}>
                  {/* Medal / position */}
                  <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                    {isTop3
                      ? <span style={{ fontSize: 30 }}>{MEDAL[pos]}</span>
                      : <span style={{ fontSize: 22, fontWeight: 900, color: '#4b5563' }}>{r.finishPosition}</span>}
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 17, fontWeight: 800,
                      color: isTop3 ? POS_COLORS[pos] : '#e5e7eb',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.username}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Team {r.team}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1 }}>TIME</div>
                      <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#d1d5db', letterSpacing: 1 }}>
                        {formatTime(r.finishTimeMs)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1 }}>🪙</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>
                        {r.coinsCollected ?? 0}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1 }}>PTS</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399' }}>
                        {r.score}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: '#6b7280', textAlign: 'center', marginBottom: 32, fontSize: 15 }}>
            No results available.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => { navigate('/lobby'); }} style={btnStyle('#1d4ed8')}>
            🎮 Play Again
          </button>
          <button onClick={() => { navigate('/'); }} style={btnStyle('#374151')}>
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  );
};

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 16px',
  background: 'linear-gradient(160deg, #050508 0%, #0e0e1c 50%, #0a0a14 100%)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '12px 28px', background: bg, border: 'none', borderRadius: 10,
  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  letterSpacing: 0.5, boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
});
