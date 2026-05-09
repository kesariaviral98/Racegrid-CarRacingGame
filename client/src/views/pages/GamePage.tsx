import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { GameScene } from '../../game/r3f/GameScene';
import type { HudData } from '../../game/r3f/GameScene';
import { HUD } from '../components/game/HUD';
import {
  connectWebSocket,
  disconnectWebSocket,
  sendInput,
  sendRaceReady,
  addMessageHandler,
  removeMessageHandler,
} from '../../controllers/websocket.controller';
import { getCurrentUser } from '../../controllers/auth.controller';
import { playCountdownBeep, playGoSound } from '../../models/services/sound.service';
import type { GameState, RaceResultWs } from '../../controllers/websocket.controller';

const getStoredCarColor = (): string =>
  localStorage.getItem('carColor') ?? '#cc1111';

// ── Traffic light countdown ────────────────────────────────────────────────

const TL_CSS = `
@keyframes tl-drop {
  from { opacity: 0; transform: translateX(-50%) translateY(-60px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes tl-pulse {
  0%,100% { transform: scale(1); }
  50%      { transform: scale(1.08); }
}
@keyframes go-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  65%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
}
`;

const TrafficLight = ({ label }: { label: string }): React.ReactElement | null => {
  if (!label) return null;
  const isGo  = label === 'GO!';
  const count = isGo ? 0 : parseInt(label, 10);

  return (
    <>
      <style>{TL_CSS}</style>
      <div style={{
        position: 'absolute', top: 90, left: '50%',
        animation: 'tl-drop 0.35s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        pointerEvents: 'none', zIndex: 5000,
      }}>
        {/* Housing */}
        <div style={{
          background: 'linear-gradient(180deg, #1c1c1c 0%, #111 100%)',
          border: '3px solid #2a2a2a',
          borderRadius: 20, padding: '14px 12px',
          display: 'flex', flexDirection: 'column', gap: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* Housing top bar */}
          <div style={{ width: 60, height: 4, background: '#2a2a2a', borderRadius: 2, margin: '-6px auto 2px' }} />

          {[0, 1, 2].map((i) => {
            // i=0 is top light, stays lit longest (count>=1 means i=0 lit)
            const redLit  = !isGo && i < count;
            const greenLit = isGo;
            const lit = redLit || greenLit;
            return (
              <div key={i} style={{
                width: 56, height: 56, borderRadius: '50%',
                background: greenLit
                  ? 'radial-gradient(circle at 35% 35%, #44ff88, #00cc44)'
                  : redLit
                    ? 'radial-gradient(circle at 35% 35%, #ff6644, #cc1100)'
                    : 'radial-gradient(circle at 35% 35%, #2a1a1a, #1a0a0a)',
                border: `2px solid ${lit ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)'}`,
                boxShadow: greenLit
                  ? '0 0 18px #00ff55, 0 0 40px rgba(0,255,85,0.45)'
                  : redLit
                    ? '0 0 18px #ff2200, 0 0 40px rgba(255,34,0,0.45)'
                    : 'inset 0 2px 8px rgba(0,0,0,0.7)',
                animation: lit ? 'tl-pulse 0.8s ease-in-out infinite' : 'none',
                transition: 'all 0.12s ease',
              }} />
            );
          })}

          {/* Count number badge */}
          {!isGo && count > 0 && (
            <div style={{
              textAlign: 'center', fontSize: 22, fontWeight: 900,
              fontFamily: 'Impact, Arial Black, sans-serif',
              color: '#ff3300', textShadow: '0 0 12px #ff2200',
              marginTop: -4,
            }}>
              {count}
            </div>
          )}
        </div>

        {/* GO! text below the housing */}
        {isGo && (
          <div style={{
            marginTop: 10,
            fontSize: 80, fontWeight: 900, letterSpacing: 6,
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: '#00ff44',
            textShadow: '0 0 24px #00ff44, 0 0 60px rgba(0,255,68,0.5), 3px 3px 0 #003300',
            animation: 'go-pop 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            GO!
          </div>
        )}
      </div>
    </>
  );
};

// ── Confetti / celebration ─────────────────────────────────────────────────

const CONFETTI_COLORS = ['#ff1144', '#ffd700', '#00e87a', '#00b4ff', '#ff8c00', '#bf00ff', '#ffffff'];

const CELEBRATION_CSS = `
@keyframes confetti-drop {
  0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(900deg); opacity: 0; }
}
@keyframes banner-pop {
  0%   { transform: scale(0.3) translateY(40px); opacity: 0; }
  65%  { transform: scale(1.08) translateY(-6px); opacity: 1; }
  100% { transform: scale(1) translateY(0);       opacity: 1; }
}
@keyframes shine {
  0%,100% { opacity: 0.6; }
  50%      { opacity: 1;   }
}
`;

type Piece = { id: number; left: string; delay: string; dur: string; color: string; size: number; rot: number; circle: boolean };

const CelebrationOverlay = (): React.ReactElement => {
  const pieces = useMemo((): Piece[] => (
    Array.from({ length: 90 }, (_, i): Piece => ({
      id: i,
      left: `${(i * 1.14) % 100}%`,
      delay: `${(i * 0.038) % 2.8}s`,
      dur: `${1.9 + (i * 0.071) % 1.6}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + (i * 3) % 11,
      rot: (i * 53) % 360,
      circle: i % 4 === 0,
    }))
  ), []);

  return (
    <>
      <style>{CELEBRATION_CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300000, pointerEvents: 'none', overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {pieces.map((p) => (
          <div key={p.id} style={{
            position: 'absolute', top: '-30px', left: p.left,
            width: p.size, height: p.size, backgroundColor: p.color,
            borderRadius: p.circle ? '50%' : '2px',
            animation: `confetti-drop ${p.dur} ${p.delay} linear infinite`,
            transform: `rotate(${p.rot}deg)`,
          }} />
        ))}

        <div style={{ animation: 'banner-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards', textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: '100px', lineHeight: 1, marginBottom: 8, animation: 'shine 1.4s ease-in-out infinite' }}>🏆</div>

          <div style={{
            fontSize: '80px', fontWeight: 900, letterSpacing: 6,
            fontFamily: 'Impact, Arial Black, sans-serif',
            background: 'linear-gradient(180deg, #ffd700 0%, #ff8c00 60%, #cc4400 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 4px 16px rgba(255,140,0,0.8))',
          }}>
            RACE OVER!
          </div>

          <div style={{ marginTop: 14, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: 3, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
            Heading to results…
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, gap: 0 }}>
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} style={{ width: 22, height: 22, backgroundColor: i % 2 === 0 ? '#fff' : '#111' }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Stun overlay ──────────────────────────────────────────────────────────

const StunOverlay = (): React.ReactElement => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 50000, pointerEvents: 'none',
    background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.35) 0%, rgba(200,0,0,0.7) 100%)',
  }}>
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      fontSize: 52, fontWeight: 900, color: '#ff2200', fontFamily: 'Impact, Arial Black, sans-serif',
      textShadow: '0 0 30px #ff0000, 2px 2px 0 #000', letterSpacing: 4,
    }}>
      !! CRASH !!
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────

export const GamePage = (): React.ReactElement => {
  const navigate  = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const [gameState,      setGameState]      = useState<GameState | null>(null);
  const [hudData,        setHudData]        = useState<HudData | null>(null);
  const [countdownLabel, setCountdownLabel] = useState('');
  const [userId,         setUserId]         = useState('');
  const [celebrating,    setCelebrating]    = useState(false);
  const [isStunned,      setIsStunned]      = useState(false);
  const raceResultsRef  = useRef<RaceResultWs[]>([]);
  const celebratingRef  = useRef(false);

  const triggerCelebration = useCallback((): void => {
    if (celebratingRef.current) return;
    celebratingRef.current = true;
    setCelebrating(true);
  }, []);

  // Navigate to results 2.5 s after celebration starts.
  // Always read results from the ref at fire-time so we get the freshest data
  // regardless of React's render batching. RACE_FINISHED always arrives well within 2.5 s.
  useEffect(() => {
    if (!celebrating || roomId === undefined) return;
    const t = window.setTimeout(() => {
      navigate(`/results/${roomId}`, { state: { results: raceResultsRef.current } });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [celebrating, navigate, roomId]);

  const handleRaceFinished = useCallback((): void => {
    triggerCelebration();
  }, [triggerCelebration]);

  const handleHudUpdate = useCallback((data: HudData): void => {
    setHudData(data);
    setIsStunned(data.isStunned ?? false);
  }, []);

  const handleInputSend = useCallback(
    (input: { up: boolean; down: boolean; left: boolean; right: boolean }) => sendInput(input),
    [],
  );

  useEffect((): (() => void) => {
    if (roomId === undefined) return () => {};

    const msgHandler = (msg: { type: string; state?: GameState; countdown?: number; results?: RaceResultWs[] }): void => {
      if (msg.type === 'ROOM_JOINED') { sendRaceReady(); return; }

      if (msg.type === 'GAME_STATE' && msg.state !== undefined) {
        setGameState(msg.state);
        if (msg.state.status === 'finished') triggerCelebration();
        return;
      }

      if (msg.type === 'RACE_STARTED' && msg.countdown !== undefined) {
        if (msg.countdown > 0) {
          setCountdownLabel(String(msg.countdown));
          playCountdownBeep();
        } else {
          setCountdownLabel('GO!');
          playGoSound();
          setTimeout(() => setCountdownLabel(''), 1100);
        }
        return;
      }

      if (msg.type === 'RACE_FINISHED') {
        const results = msg.results ?? [];
        raceResultsRef.current = results;
        try { sessionStorage.setItem('raceResults', JSON.stringify(results)); } catch { /* ignore */ }
        triggerCelebration();
      }
    };

    const init = async (): Promise<void> => {
      const user = await getCurrentUser();
      if (user === null) { navigate('/login'); return; }
      setUserId(user.id);
      addMessageHandler(msgHandler);
      connectWebSocket(roomId, user.id, user.tenantId, user.username);
    };
    void init();

    return () => {
      removeMessageHandler(msgHandler);
      disconnectWebSocket();
    };
  }, [roomId, navigate, triggerCelebration]);

  const handleExit = (): void => { disconnectWebSocket(); navigate('/lobby'); };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <GameScene
        localUserId={userId} gameState={gameState} carColor={getStoredCarColor()}
        onInputSend={handleInputSend} onHudUpdate={handleHudUpdate}
        onRaceFinished={handleRaceFinished} countdownLabel={countdownLabel}
        raceOver={celebrating}
      />

      {hudData !== null && <HUD hudData={hudData} />}
      {isStunned && !celebrating && <StunOverlay />}

      {/* Traffic-light countdown replaces plain text */}
      <TrafficLight label={countdownLabel} />

      {celebrating && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300000, pointerEvents: 'none' }}>
          <CelebrationOverlay />
        </div>
      )}

      {/* Lobby button — portalled to document.body so it's never buried under Canvas/overlays.
          Hidden during celebration to prevent accidental clicks through the overlay. */}
      {!celebrating && createPortal(
        <button
          onClick={handleExit}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 999999,
            padding: '6px 14px', background: '#7f1d1d', border: '1px solid #ef4444',
            borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          ← Lobby
        </button>,
        document.body,
      )}
    </div>
  );
};
