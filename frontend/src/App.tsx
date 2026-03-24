
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAppSelector } from './hooks';
import { setCurrency } from './utils/currency';
import AdminLayout from './components/AdminLayout';
import AdminGalleryManager from './components/AdminGalleryManager';
import AdminUsersManager from './components/AdminUsersManager';
import AdminArtworkApprovals from './components/AdminArtworkApprovals';
import AdminApprovalsManager from './components/AdminApprovalsManager';
import UserApprovalsManager from './components/UserApprovalsManager';
import AdminProfileApprovals from './components/AdminProfileApprovals';
import AdminSettingsManager from './components/AdminSettingsManager';
import AdminPaymentsManager from './components/AdminPaymentsManager';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import GalleryPage from './pages/GalleryPage';
import ShopPage from './pages/ShopPage';
import AccountPage from './pages/AccountPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ArtworkDetailPage from './pages/ArtworkDetailPage';
import FilteredArtworkPage from './pages/FilteredArtworkPage';
import FilteredByUserArtworkPage from './pages/FilteredByUserArtworkPage';
import UsersGalleryPage from './pages/UsersGalleryPage';
import { MyOffersPage } from './pages/MyOffersPage';
import axios from 'axios';

// Wrapper component for approvals route
const ApprovalsRoute: React.FC = () => {
  const { user } = useAppSelector(state => state.auth);
  return user?.role === 'admin' ? <AdminApprovalsManager /> : <UserApprovalsManager />;
};


const App: React.FC = () => {
  const { token } = useAppSelector(state => state.auth);

  useEffect(() => {
    // Načti měnu ze settings
    const loadCurrency = async () => {
      try {
        const response = await axios.get('/api/auth/public');
        const currencySetting = response.data;
        if (currencySetting && currencySetting.value) {
          setCurrency(currencySetting.value);
        }
      } catch (err) {
        console.error('Failed to load currency setting:', err);
        // Používej výchozí CZK
      }
    };

    loadCurrency();
  }, [token]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<GalleryPage />} />
        <Route path="/artwork/:id" element={<ArtworkDetailPage />} />
        <Route path="/gallery/:status" element={<FilteredArtworkPage />} />
        <Route path="/gallery/:filterType/:userId" element={<FilteredByUserArtworkPage />} />
        <Route path="/gallery/:filterType/users" element={<UsersGalleryPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/offers" element={<MyOffersPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminGalleryManager />} />
          <Route path="gallery" element={<AdminGalleryManager />} />
          <Route path="users" element={<AdminUsersManager />} />
          <Route path="payments" element={<AdminPaymentsManager />} />
          <Route path="settings" element={<AdminSettingsManager />} />
          <Route path="approvals" element={<ApprovalsRoute />} />
          <Route path="artwork-approvals" element={<AdminArtworkApprovals />} />
          <Route path="profile-approvals" element={<AdminProfileApprovals />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;