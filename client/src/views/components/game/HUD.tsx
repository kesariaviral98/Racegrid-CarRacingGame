import type { HudData } from '../../../game/r3f/GameScene';
import { TRACK_LENGTH, TOTAL_LAPS } from '../../../constants/game.constants';

const TOTAL_MAP_LENGTH = TRACK_LENGTH * TOTAL_LAPS;

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

const getOrdinal = (n: number): string => {
  if (n === 1) return '1ST';
  if (n === 2) return '2ND';
  if (n === 3) return '3RD';
  return `${n}TH`;
};

// ── Speedometer arc ───────────────────────────────────────────────────────────
const SpeedometerArc = ({ speed }: { speed: number }): React.ReactElement => {
  const MAX_KMH = 216;
  const pct = Math.min(1, speed / MAX_KMH);
  const R = 52;
  const CX = 68;
  const CY = 68;
  const START_ANGLE = 210;
  const SWEEP = 240;

  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const arcPath = (startDeg: number, endDeg: number): string => {
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = CX + R * Math.cos(s);
    const y1 = CY + R * Math.sin(s);
    const x2 = CX + R * Math.cos(e);
    const y2 = CY + R * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  };

  const fillEnd = START_ANGLE + SWEEP * pct;
  const color = pct > 0.83 ? '#ff4400' : pct > 0.55 ? '#ffaa00' : '#00dd55';

  return (
    <svg width={136} height={100} style={{ overflow: 'visible' }}>
      <path d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={7} strokeLinecap="round" />
      {pct > 0 && (
        <path d={arcPath(START_ANGLE, fillEnd)}
          fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      )}
      <text x={CX} y={CY + 6} textAnchor="middle" fill="#fff"
        fontSize={26} fontWeight={900} fontFamily="monospace">
        {speed}
      </text>
      <text x={CX} y={CY + 22} textAnchor="middle" fill="rgba(255,255,255,0.5)"
        fontSize={10} fontFamily="system-ui">
        KM/H
      </text>
    </svg>
  );
};

// ── Mini-map ──────────────────────────────────────────────────────────────────
const MiniMap = ({ localZ, otherPlayersZ }: { localZ: number; otherPlayersZ: number[] }): React.ReactElement => {
  const MAP_H = 96;
  const TRACK_W = 12;

  const toY = (z: number): number => MAP_H * (1 - Math.min(1, Math.max(0, z) / TOTAL_MAP_LENGTH));

  const localY = toY(localZ);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>
        MAP
      </div>

      <div style={{ position: 'relative', width: TRACK_W + 20, height: MAP_H }}>
        {/* Track strip */}
        <div style={{
          position: 'absolute', left: 10, top: 0, width: TRACK_W, height: MAP_H,
          background: '#1e2d3a', borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.12)',
        }} />

        {/* Finish line (top = z=4500) */}
        <div style={{
          position: 'absolute', left: 8, top: 0, width: TRACK_W + 4, height: 2,
          background: 'repeating-linear-gradient(90deg, #fff 0px, #fff 3px, #111 3px, #111 6px)',
        }} />

        {/* Lap markers at 1/3 and 2/3 */}
        {[1 / 3, 2 / 3].map((pct, i) => (
          <div key={i} style={{
            position: 'absolute', left: 8, top: MAP_H * (1 - pct) - 0.5,
            width: TRACK_W + 4, height: 1, background: 'rgba(255,220,0,0.5)',
          }} />
        ))}

        {/* Start line (bottom) */}
        <div style={{
          position: 'absolute', left: 8, bottom: 0, width: TRACK_W + 4, height: 2,
          background: '#00cc44',
        }} />

        {/* Other players (red dots, right side of strip) */}
        {otherPlayersZ.map((z, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: toY(z) - 3,
            left: 10 + TRACK_W - 1,
            width: 7, height: 7, borderRadius: '50%',
            background: '#ff4444',
            boxShadow: '0 0 4px #ff4444',
            transform: 'translateY(-50%)',
          }} />
        ))}

        {/* Local player (gold dot, left side of strip) */}
        <div style={{
          position: 'absolute',
          top: localY,
          left: 10,
          width: 10, height: 10, borderRadius: '50%',
          background: '#ffd700',
          boxShadow: '0 0 6px #ffd700, 0 0 12px rgba(255,215,0,0.4)',
          border: '1px solid rgba(255,255,255,0.6)',
          transform: 'translate(-2px, -5px)',
        }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 6, fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
        <span style={{ color: '#ffd700' }}>● YOU</span>
        {otherPlayersZ.length > 0 && <span style={{ color: '#ff4444' }}>● BOT</span>}
      </div>
    </div>
  );
};

// ── Main HUD ──────────────────────────────────────────────────────────────────
export const HUD = ({ hudData }: { hudData: HudData }): React.ReactElement => {
  const { speed, lap, totalLaps, position, totalPlayers, raceTimeMs, coinsCollected, localZ, otherPlayersZ } = hudData;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── Top-left: Lap + position ── */}
      <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>

        <div style={{
          background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>Lap</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              {Math.min(lap + 1, totalLaps)}
            </span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>/ {totalLaps}</span>
          </div>
        </div>

        <div style={{
          background: position === 1
            ? 'linear-gradient(135deg, rgba(255,180,0,0.25), rgba(255,120,0,0.18))'
            : 'rgba(0,0,0,0.72)',
          border: position === 1 ? '1px solid rgba(255,200,0,0.5)' : '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(6px)', borderRadius: 10, padding: '7px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>Position</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: 28, fontWeight: 900, lineHeight: 1,
              color: position === 1 ? '#ffd700' : '#fff',
              textShadow: position === 1 ? '0 0 12px rgba(255,200,0,0.7)' : 'none',
            }}>
              {getOrdinal(position)}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>/ {totalPlayers}</span>
          </div>
        </div>
      </div>

      {/* ── Top-center: Timer ── */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 20px',
        textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>Race Time</div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#fff', letterSpacing: 2 }}>
          {formatTime(raceTimeMs)}
        </div>
      </div>

      {/* ── Top-right: Coins ── */}
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <div style={{
          background: coinsCollected > 0
            ? 'linear-gradient(135deg, rgba(255,180,0,0.22), rgba(180,100,0,0.18))'
            : 'rgba(0,0,0,0.72)',
          border: coinsCollected > 0 ? '1px solid rgba(255,180,0,0.45)' : '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(6px)', borderRadius: 10, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontSize: 22 }}>🪙</span>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>Coins</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffd700', lineHeight: 1, textShadow: coinsCollected > 0 ? '0 0 10px rgba(255,200,0,0.6)' : 'none' }}>
              {coinsCollected}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom-left: Speedometer ── */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(6px)', borderRadius: 12,
        padding: '8px 10px 4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}>
        <SpeedometerArc speed={speed} />
      </div>

      {/* ── Bottom-right: Mini-map ── */}
      <div style={{ position: 'absolute', bottom: 14, right: 14 }}>
        <MiniMap localZ={localZ} otherPlayersZ={otherPlayersZ} />
      </div>

      {/* ── Bottom-center: Controls hint ── */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(4px)', borderRadius: 8, padding: '6px 12px',
        fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7,
        textAlign: 'center',
      }}>
        W/↑ Accel &nbsp;·&nbsp; S/↓ Brake &nbsp;·&nbsp; A D/← → Steer
      </div>

      {/* Crash vignette rendered by StunOverlay in GamePage */}
    </div>
  );
};
