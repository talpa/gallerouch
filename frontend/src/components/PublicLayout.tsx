import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout } from '../features/authSlice';
import { getUnreadOffersCount } from '../api/offers';
import './PublicLayout.css';

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, token } = useAppSelector(state => state.auth);
  const { t, i18n } = useTranslation();
  const [unreadOffersCount, setUnreadOffersCount] = useState(0);

  // Load unread offers count
  useEffect(() => {
    if (user && token) {
      loadUnreadOffersCount();
      // Refresh every 30 seconds
      const interval = setInterval(loadUnreadOffersCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  const loadUnreadOffersCount = async () => {
    if (!token) return;
    try {
      const count = await getUnreadOffersCount(token);
      setUnreadOffersCount(count);
    } catch (err) {
      console.error('Error loading unread offers count:', err);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'cs' ? 'en' : 'cs';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="header-content">
          <h1>{t('header.title')}</h1>
          <nav className="main-nav">
            <Link to="/">{t('common.home')}</Link>
          </nav>
        </div>
        <div className="user-menu">
          <button className="language-toggle" onClick={toggleLanguage} title={t('actions.toggleLanguage')}>
            🌐 {i18n.language.toUpperCase()}
          </button>
          {user ? (
            <div className="user-menu-authenticated">
              <div className="user-greeting">
                👤 {user.username}
              </div>
              <div className="menu-buttons">
                {unreadOffersCount > 0 && (
                  <Link 
                    to="/offers" 
                    className="menu-btn offers-btn"
                    title={t('offers.myOffers')}
                  >
                    💰 {unreadOffersCount}
                  </Link>
                )}
                <Link to="/account" className="menu-btn account-btn">{t('header.myProfile')}</Link>
                <button className="menu-btn logout-btn" onClick={handleLogout}>{t('common.logout')}</button>
              </div>
            </div>
          ) : (
            <div className="user-menu-anonymous">
              <Link to="/login" className="menu-btn login-btn">{t('common.login')}</Link>
              <Link to="/register" className="menu-btn register-btn">{t('common.register')}</Link>
            </div>
          )}
        </div>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">&copy; {new Date().getFullYear()} Gallerouch</footer>
    </div>
  );
};

export default PublicLayout;
