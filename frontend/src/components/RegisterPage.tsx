import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Hesla se neshodují');
      return;
    }

    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/register', {
        username,
        email,
        password,
      });
      setSuccess('Registrace úspěšná! Nyní se můžete přihlásit.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Chyba při registraci');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h2>Gallerouch</h2>
          <p>Vytvoření nového účtu</p>
        </div>

        <div className="login-form">
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Uživatelské jméno</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Zvolte uživatelské jméno"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Zadejte váš email"
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
                placeholder="Zvolte silné heslo (min. 6 znaků)"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Potvrdit heslo</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Zopakujte heslo"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Registruji...' : 'Registrovat se'}
            </button>
          </form>

          <div className="credentials-info">
            <strong>ℹ️ Bezpečnost hesla:</strong>
            Minimálně 6 znaků<br />
            Zvolte si unikátní heslo
          </div>

          <div className="login-footer">
            Již máte účet? <a href="/login">Přihlaste se zde</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
