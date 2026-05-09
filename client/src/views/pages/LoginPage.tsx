import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp } from '../../controllers/auth.controller';

type Mode = 'signin' | 'signup';

export const LoginPage = (): React.ReactElement => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = mode === 'signup'
        ? await signUp(email, password, username.trim())
        : await signIn(email, password);

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else {
        message = 'Authentication failed';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (): void => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  };

  const isSignUp = mode === 'signup';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #050508 0%, #0e0e1c 45%, #0a0a14 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, padding: '36px 40px', width: '100%', maxWidth: 420,
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>🏎️</div>
          <div style={{
            fontSize: 22, fontWeight: 900, letterSpacing: 4,
            fontFamily: 'Impact, Arial Black, sans-serif',
            background: 'linear-gradient(180deg, #ff8800, #ff2200)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            RACEGRID
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 10,
          padding: 4, marginBottom: 28, gap: 4,
        }}>
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 7,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
                background: mode === m ? '#ff4400' : 'transparent',
                color: mode === m ? '#fff' : '#9ca3af',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e: React.FormEvent<HTMLFormElement>): void => { void handleSubmit(e); }}
        >
          {/* Username field — signup only */}
          {isSignUp && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); }}
                required={isSignUp}
                minLength={2}
                maxLength={20}
                placeholder="RacerName"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              required
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              required
              minLength={6}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error !== null && (
            <div style={{
              background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', border: 'none', borderRadius: 10,
              background: loading ? '#374151' : 'linear-gradient(135deg, #ff4400, #cc2200)',
              color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: 0.5,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 20px rgba(255,68,0,0.4)',
            }}
          >
            {loading
              ? (isSignUp ? 'Creating account…' : 'Signing in…')
              : (isSignUp ? '🏁 Create Account & Race' : '🔑 Sign In')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6b7280' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={switchMode}
            style={{
              background: 'none', border: 'none', color: '#ff6622',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
            }}
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
};
