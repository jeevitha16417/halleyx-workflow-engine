import React, { useState } from 'react';
import { login } from '../api';

// hardcoded demo users for quick access during presentation
const DEMO_USERS = [
  { username: 'admin',   password: 'admin123', role: 'Admin',   color: '#3fb950' },
  { username: 'manager', password: 'mgr123',   role: 'Manager', color: '#d29922' },
  { username: 'ceo',     password: 'ceo123',   role: 'CEO',     color: '#bc8cff' },
  { username: 'finance', password: 'fin123',   role: 'Finance', color: '#58a6ff' },
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (u, p) => {
    setLoading(true);
    setError('');
    try {
      const res = await login({ username: u || username, password: p || password });
      onLogin(res.user);
    } catch (e) {
      setError(e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (user) => {
    setUsername(user.username);
    setPassword(user.password);
    handleLogin(user.username, user.password);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
      padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: '#1a2e1c', border: '1px solid #2ea043',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="#3fb950" strokeWidth="1.5" fill="none"/>
              <circle cx="12" cy="12" r="3" fill="#3fb950" opacity="0.7"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Halleyx</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            WORKFLOW ENGINE
          </div>
        </div>

        {/* Login card */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 28
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>
            Sign in to your account
          </div>

          {error && (
            <div style={{
              background: '#2d1214', border: '1px solid #6e2c2a',
              color: '#f85149', padding: '9px 13px', borderRadius: 6,
              fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 14
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: 'var(--text2)', textTransform: 'uppercase',
              letterSpacing: '0.07em', fontFamily: 'var(--mono)', marginBottom: 6
            }}>Username</label>
            <input
              className="form-input"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: 'var(--text2)', textTransform: 'uppercase',
              letterSpacing: '0.07em', fontFamily: 'var(--mono)', marginBottom: 6
            }}>Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            onClick={() => handleLogin()}
            disabled={loading || !username || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        {/* Quick login for demo */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 20, marginTop: 14
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12
          }}>
            Quick login — demo accounts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.username}
                onClick={() => quickLogin(u)}
                disabled={loading}
                style={{
                  background: 'var(--bg3)', border: `1px solid var(--border)`,
                  borderRadius: 6, padding: '9px 12px', cursor: 'pointer',
                  textAlign: 'left', transition: 'border-color 0.15s',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = u.color}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: u.color }}>
                  {u.role}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                  {u.username} / {u.password}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}