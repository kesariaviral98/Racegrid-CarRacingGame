import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut } from '../../controllers/auth.controller';
import { handleCreateRoom as createRoomApi } from '../../controllers/room.controller';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '../../models/types/user.types';

const HOME_CSS = `
@keyframes streak {
  0%   { transform: translateX(-120%) scaleX(0.4); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: translateX(120%) scaleX(1);   opacity: 0; }
}
@keyframes pulse-glow {
  0%,100% { filter: drop-shadow(0 0 18px #ff4400) drop-shadow(0 0 40px #ff2200); }
  50%     { filter: drop-shadow(0 0 32px #ff6600) drop-shadow(0 0 70px #ff4400); }
}
@keyframes card-rise {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const STREAKS = [
  { top: '12%', delay: '0s',    dur: '2.2s', w: '38%', opacity: 0.18 },
  { top: '24%', delay: '0.6s',  dur: '1.8s', w: '55%', opacity: 0.12 },
  { top: '38%', delay: '1.1s',  dur: '2.5s', w: '28%', opacity: 0.22 },
  { top: '52%', delay: '0.3s',  dur: '2.0s', w: '45%', opacity: 0.15 },
  { top: '66%', delay: '0.9s',  dur: '1.6s', w: '60%', opacity: 0.10 },
  { top: '78%', delay: '1.4s',  dur: '2.3s', w: '35%', opacity: 0.20 },
  { top: '89%', delay: '0.5s',  dur: '1.9s', w: '50%', opacity: 0.14 },
];

const FEATURES = [
  { icon: '🏎️', title: 'Street Racing',  desc: 'High-speed circuit races against real opponents or bots' },
  { icon: '🪙', title: 'Coin Hunt',      desc: 'Collect coins scattered across the track for bonus points' },
  { icon: '💥', title: 'Crash & Bash',   desc: 'Ram opponents — collisions stun rivals and swing the race' },
  { icon: '🚧', title: 'Dodge Obstacles',desc: 'Rocks, barrels and cones — hit them and you grind to a halt' },
];

export const HomePage = (): React.ReactElement => {
  const navigate  = useNavigate();
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const handleSignOut = async (): Promise<void> => {
    await signOut().catch(() => {});
    setUser(null);
  };

  // Create a room and immediately start a solo race (bot fills in server-side)
  const handleSoloRace = async (): Promise<void> => {
    if (user === null || starting) return;
    setStarting(true);
    try {
      const room = await createRoomApi(user.tenantId, user.id);
      await supabase.channel(`room:${room.id}`).send({
        type: 'broadcast', event: 'race_started', payload: { roomId: room.id },
      });
      navigate(`/game/${room.id}`);
    } catch { setStarting(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #050508 0%, #0e0e1c 45%, #0a0a14 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif', overflowX: 'hidden',
    }}>
      <style>{HOME_CSS}</style>

      {/* Speed streaks background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {STREAKS.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.top, left: 0,
            width: s.w, height: 2,
            background: 'linear-gradient(90deg, transparent 0%, #ff5500 50%, transparent 100%)',
            opacity: s.opacity,
            animation: `streak ${s.dur} ${s.delay} linear infinite`,
          }} />
        ))}
      </div>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', position: 'relative', zIndex: 10 }}>
        <span style={{ color: '#ff4400', fontSize: 18, fontWeight: 800, letterSpacing: 3 }}>RACEGRID</span>
        {!loading && user !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#9ca3af', fontSize: 14 }}>
              Hey, <span style={{ color: '#fff', fontWeight: 600 }}>{user.username}</span>
            </span>
            <button onClick={() => void handleSignOut()} style={{
              padding: '5px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, color: '#9ca3af', fontSize: 13, cursor: 'pointer',
            }}>Sign Out</button>
          </div>
        )}
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 0', position: 'relative', zIndex: 10 }}>

        {/* Logo car */}
        <div style={{ fontSize: 80, marginBottom: 8, animation: 'pulse-glow 2.8s ease-in-out infinite', lineHeight: 1 }}>🏎️</div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(56px, 10vw, 96px)', fontWeight: 900, margin: '0 0 6px',
          fontFamily: 'Impact, Arial Black, sans-serif', letterSpacing: 6,
          background: 'linear-gradient(180deg, #ff8800 0%, #ff2200 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 20px rgba(255,80,0,0.6))',
        }}>RACEGRID</h1>

        <p style={{ color: '#6b7280', fontSize: 15, letterSpacing: 5, textTransform: 'uppercase', margin: '0 0 40px' }}>
          Multiplayer Road Racing
        </p>

        {/* Checkered divider */}
        <div style={{ display: 'flex', marginBottom: 40 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{ width: 16, height: 16, backgroundColor: i % 2 === 0 ? '#ffffff22' : '#00000044' }} />
          ))}
        </div>

        {/* Action buttons */}
        {loading && <div style={{ color: '#6b7280', fontSize: 14, padding: 24 }}>Loading…</div>}

        {!loading && user === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300 }}>
            <ActionButton label="Sign In to Play" onClick={() => navigate('/login')}
              gradient="linear-gradient(135deg, #ff4400, #cc2200)" glow="rgba(255,68,0,0.5)" icon="🔑" />
          </div>
        )}

        {!loading && user !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 320, animation: 'card-rise 0.5s ease-out' }}>
            {/* Solo race */}
            <ActionButton
              label={starting ? 'Starting…' : '⚡  Solo Race vs Bot'}
              onClick={() => void handleSoloRace()}
              gradient="linear-gradient(135deg, #ff4400 0%, #cc2000 100%)"
              glow="rgba(255,60,0,0.55)"
              desc="Race alone against an AI bot — instant start"
            />

            {/* Multiplayer */}
            <ActionButton
              label="👥  Multiplayer"
              onClick={() => navigate('/lobby')}
              gradient="linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)"
              glow="rgba(29,78,216,0.45)"
              desc="Create or join a room and race real players"
            />

            {/* Admin */}
            {user.role === 'admin' && (
              <ActionButton
                label="🛡️  Admin Console"
                onClick={() => navigate('/admin')}
                gradient="linear-gradient(135deg, #4f46e5 0%, #312e81 100%)"
                glow="rgba(79,70,229,0.4)"
              />
            )}
          </div>
        )}

        {/* Feature cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14, marginTop: 52, width: '100%', maxWidth: 720,
          animation: 'card-rise 0.7s ease-out',
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '18px 16px', textAlign: 'center',
              animationDelay: `${i * 0.1}s`,
            }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
              <div style={{ color: '#6b7280', fontSize: 11, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom track stripe */}
      <div style={{ height: 80, position: 'relative', marginTop: 40, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #111 0%, transparent 100%)' }} />
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: '70%', height: 3, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(255,68,0,0.4), transparent)' }} />
      </div>
    </div>
  );
};

// ── Reusable button ──────────────────────────────────────────────────────────

const ActionButton = ({
  label, onClick, gradient, glow, desc, icon,
}: {
  label: string; onClick: () => void; gradient: string; glow: string; desc?: string; icon?: string;
}): React.ReactElement => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: desc !== undefined ? '14px 18px' : '14px 18px',
        background: gradient, border: 'none', borderRadius: 12,
        boxShadow: hovered ? `0 0 32px ${glow}, 0 4px 20px rgba(0,0,0,0.4)` : `0 0 14px ${glow.replace('0.55', '0.25').replace('0.45', '0.2').replace('0.4', '0.18')}`,
        cursor: 'pointer', textAlign: 'left', transition: 'box-shadow 0.2s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: 0.5 }}>
        {icon !== undefined && <span style={{ marginRight: 8 }}>{icon}</span>}
        {label}
      </div>
      {desc !== undefined && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3, fontWeight: 400 }}>{desc}</div>}
    </button>
  );
};
