import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { login } from '../features/authSlice';
import { useNavigate, useLocation } from 'react-router-dom';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error } = useAppSelector(state => state.auth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(login({ username, password }));
    if (login.fulfilled.match(result)) {
      // Vrátit se zpět na místo, odkud jsme přišli, nebo domů
      const from = (location.state as any)?.from || '/';
      navigate(from);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:4777/api/auth/google';
  };

  const handleFacebookLogin = () => {
    window.location.href = 'http://localhost:4777/api/auth/facebook';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h2>Gallerouch</h2>
          <p>Přihlášení do vašeho účtu</p>
        </div>

        <div className="login-form">
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Uživatelské jméno</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Zadejte uživatelské jméno"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Heslo</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Zadejte heslo"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Přihlašuji...' : 'Přihlásit se'}
            </button>
          </form>

          <div className="credentials-info">
            <strong>Testovací účty:</strong>
            Admin: admin / admin123<br />
            User: jana / admin123
          </div>

          <div className="divider">
            <span>nebo</span>
          </div>

          <div className="social-buttons">
            <button 
              type="button"
              className="btn-social google"
              onClick={handleGoogleLogin}
            >
              <span>🔐</span> Přihlásit se přes Google
            </button>
            <button 
              type="button"
              className="btn-social facebook"
              onClick={handleFacebookLogin}
            >
              <span>f</span> Přihlásit se přes Facebook
            </button>
          </div>

          <div className="login-footer">
            Nemáte účet? <a href="/register">Registrujte se zde</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
