import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../hooks';
import { useTranslation } from 'react-i18next';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import UserArtworkManager from '../components/UserArtworkManager';
import UserProfileManager from '../components/UserProfileManager';
import UserEventsTable from '../components/UserEventsTable';
import UserPaymentsManager from '../components/UserPaymentsManager';
import AuthorBioEditor from '../components/AuthorBioEditor';
import AdminGalleryManager from '../components/AdminGalleryManager';
import AdminArtworkTypesManager from '../components/AdminArtworkTypesManager';
import AdminUsersManager from '../components/AdminUsersManager';
import AdminApprovalsManager from '../components/AdminApprovalsManager';
import AdminArtworkApprovals from '../components/AdminArtworkApprovals';
import AdminProfileApprovals from '../components/AdminProfileApprovals';
import AdminAuthorApprovals from '../components/AdminAuthorApprovals';
import AdminSettingsManager from '../components/AdminSettingsManager';
import AdminPaymentsManager from '../components/AdminPaymentsManager';

const AccountPage: React.FC = () => {
  const { user } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('admin-gallery');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  // Admin view
  if (user.role === 'admin') {
    return (
      <PublicLayout>
        <div className="container mt-4">
          <h2>{t('account.administration')}</h2>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'admin-gallery')}
            className="mb-3"
          >
            <Tab eventKey="admin-gallery" title={t('account.adminGallery')}>
              <AdminGalleryManager />
            </Tab>
            <Tab eventKey="admin-artwork-types" title={t('account.adminArtworkTypes')}>
              <AdminArtworkTypesManager />
            </Tab>
            <Tab eventKey="profile" title={`👤 ${t('account.profileAndBanking')}`}>
              <div className="alert alert-info mt-3" role="alert">
                Tato stránka je rozdělena na dvě části: osobní profil a autorský profil.
                Každá část se schvaluje samostatně.
              </div>
              <h4 className="mt-3">👤 {t('account.profileAndBanking')}</h4>
              <UserProfileManager />
              <div className="mt-4">
                <h4 className="mb-3">🎨 {t('account.authorProfile')}</h4>
                <p className="text-muted mb-3">
                  Biografie a typy děl se schvalují jako autorský profil.
                </p>
                <AuthorBioEditor />
              </div>
            </Tab>
            <Tab eventKey="events" title={t('account.myEvents')}>
              <div className="mt-3">
                <p>{t('account.eventsDescription')}</p>
                <UserEventsTable />
              </div>
            </Tab>
            <Tab eventKey="admin-users" title={t('account.adminUsers')}>
              <AdminUsersManager />
            </Tab>
            <Tab eventKey="admin-approvals" title={t('account.adminApprovals')}>
              <AdminApprovalsManager />
            </Tab>
            <Tab eventKey="admin-artwork-approvals" title={t('account.adminArtworkApprovals')}>
              <AdminArtworkApprovals />
            </Tab>
            <Tab eventKey="admin-profile-approvals" title={`👤 ${t('account.adminProfileApprovals')}`}>
              <AdminProfileApprovals />
            </Tab>
            <Tab eventKey="admin-author-approvals" title={`🎨 ${t('account.adminAuthorApprovals')}`}>
              <AdminAuthorApprovals />
            </Tab>
            <Tab eventKey="settings" title={t('account.adminSettings')}>
              <AdminSettingsManager />
            </Tab>
            <Tab eventKey="admin-payments-manager" title={t('account.adminPaymentsManager')}>
              <AdminPaymentsManager />
            </Tab>
          </Tabs>
        </div>
      </PublicLayout>
    );
  }

  // User view
  return (
    <PublicLayout>
      <div className="container mt-4">
        <h2>{t('account.myAccount')}</h2>
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'artworks')}
          className="mb-3"
        >
          <Tab eventKey="artworks" title={t('account.myArtworks')}>
            <UserArtworkManager />
          </Tab>
          <Tab eventKey="profile" title={`👤 ${t('account.profileAndBanking')}`}>
            <UserProfileManager />
          </Tab>
          <Tab eventKey="author-bio" title={`🎨 ${t('account.authorProfile')}`}>
            <AuthorBioEditor />
          </Tab>
          <Tab eventKey="events" title={t('account.myEvents')}>
            <div className="mt-3">
              <p>{t('account.eventsDescription')}</p>
              <UserEventsTable />
            </div>
          </Tab>
          <Tab eventKey="payments" title={t('payments.myPayments')}>
            <UserPaymentsManager />
          </Tab>
        </Tabs>
      </div>
    </PublicLayout>
  );
};

export default AccountPage;
