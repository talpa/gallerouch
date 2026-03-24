import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout } from '../features/authSlice';
import './AdminLayout.css';

const AdminLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector(state => state.auth);
  const { t, i18n } = useTranslation();

  // Redirect regular users to gallery page
  useEffect(() => {
    if (user && user.role !== 'admin' && window.location.pathname === '/admin') {
      navigate('/admin/gallery');
    }
  }, [user, navigate]);

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
    <div className="admin-layout">
      <header className="admin-header">
        <div className="header-content">
          <h1>{user?.role === 'admin' ? t('header.adminPanel') : t('header.myGallery')}</h1>
          <p style={{fontSize: '10px', color: 'red'}}>DEBUG: role={user?.role}, isAdmin={user?.role === 'admin'}</p>
          <nav className="main-nav">
            <NavLink to="/" end>{t('common.home')}</NavLink>
            
              <NavLink to="/admin/settings" className="settings-link">
                ⚙️ {t('admin.settings')} tttttt
              </NavLink>
                {user?.role === 'admin' ? (
              <>
                <NavLink to="/admin/gallery">{t('gallery.allArtworks')}</NavLink>
                <NavLink to="/admin/users">{t('admin.users')}</NavLink>
                <NavLink to="/admin/payments">💰 {t('admin.payments') || 'Platby'}</NavLink>
                <div className="nav-group">
                  <span className="nav-group-label">✅ {t('admin.approvals')}</span>
                  <NavLink to="/admin/offers">📋 {t('admin.offers') || 'Nabídky'}</NavLink>
                  <NavLink to="/admin/approvals">{t('header.adminApprovals')}</NavLink>
                  <NavLink to="/admin/artwork-approvals">{t('header.adminArtworkApprovals')}</NavLink>
                  <NavLink to="/admin/profile-approvals">{t('header.adminProfileApprovals')}</NavLink>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/admin/gallery">{t('gallery.myArtworks')}</NavLink>
                <NavLink to="/admin/approvals">{t('admin.events')}</NavLink>
              </>
            )}
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
                <NavLink to="/account" className="menu-btn account-btn">{t('header.myProfile')}</NavLink>
                <button className="menu-btn logout-btn" onClick={handleLogout}>{t('common.logout')}</button>
              </div>
            </div>
          ) : (
            <div className="user-menu-anonymous">
              <NavLink to="/login" className="menu-btn login-btn">{t('common.login')}</NavLink>
            </div>
          )}
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
