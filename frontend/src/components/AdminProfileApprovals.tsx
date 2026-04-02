import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../hooks';
import axios from 'axios';
import './AdminProfileApprovals.css';

interface UserProfileData {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  birthNumber?: string;
  permanentAddress?: string;
  permanentCity?: string;
  permanentPostalCode?: string;
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  bankAccountNumber?: string;
  bankCode?: string;
  bankName?: string;
  bio?: string;
  bioEn?: string;
  profileApproved?: boolean;
  profileApprovedAt?: string;
  profileApprovedBy?: number;
}

const AdminProfileApprovals: React.FC = () => {
  const { token } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfileData | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(t('profile.failedFetchUsers'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: number) => {
    try {
      await axios.post(`/api/auth/users/${userId}/approve-profile`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
      setSelectedUser(null);
    } catch (err) {
      console.error('Failed to approve profile:', err);
      setError(t('profile.failedApproveProfile'));
    }
  };

  const handleReject = async (userId: number) => {
    try {
      await axios.post(`/api/auth/users/${userId}/reject-profile`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
      setSelectedUser(null);
    } catch (err) {
      console.error('Failed to reject profile:', err);
      setError(t('profile.failedRejectProfile'));
    }
  };

  const filteredUsers = users.filter(user => {
    if (filter === 'pending') return user.profileApproved === false && !user.profileApprovedAt;
    if (filter === 'approved') return user.profileApproved === true;
    if (filter === 'rejected') return user.profileApproved === false && user.profileApprovedAt;
    return true;
  });

  const pendingCount = users.filter(u => u.profileApproved === false && !u.profileApprovedAt).length;
  const approvedCount = users.filter(u => u.profileApproved === true).length;
  const rejectedCount = users.filter(u => u.profileApproved === false && u.profileApprovedAt).length;

  if (loading) {
    return <div className="admin-profile-approvals"><p>{t('common.loading')}</p></div>;
  }

  return (
    <div className="admin-profile-approvals">
      <h2>{t('profile.approvals')}</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="filter-buttons mb-3">
        <button
          className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setFilter('pending')}
        >
          {t('profile.pendingApprovals')} ({pendingCount})
        </button>
        <button
          className={`btn ${filter === 'approved' ? 'btn-success' : 'btn-outline-success'}`}
          onClick={() => setFilter('approved')}
        >
          {t('profile.approvedProfiles')} ({approvedCount})
        </button>
        <button
          className={`btn ${filter === 'rejected' ? 'btn-danger' : 'btn-outline-danger'}`}
          onClick={() => setFilter('rejected')}
        >
          {t('profile.rejectedProfiles')} ({rejectedCount})
        </button>
      </div>

      <div className="users-table">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>{t('profile.username') || 'Uživatel'}</th>
              <th>{t('profile.email')}</th>
              <th>{t('profile.bio') || 'Biografie'}</th>
              <th>{t('profile.role')}</th>
              <th>{t('profile.approvalStatus')}</th>
              <th>{t('profile.registered')}</th>
              <th>{t('buttons.approve')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <div style={{ fontSize: '0.85rem' }}>
                    {user.bio && <span style={{ color: '#28a745', marginRight: '0.5rem' }}>🇨🇿 CS</span>}
                    {user.bioEn && <span style={{ color: '#007bff' }}>🇬🇧 EN</span>}
                    {!user.bio && !user.bioEn && <em style={{ color: '#999' }}>-</em>}
                  </div>
                </td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-secondary'}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  {user.profileApproved ? (
                    <span className="badge bg-success">{t('profile.approved')}</span>
                  ) : (
                    <span className="badge bg-warning">{t('profile.pending')}</span>
                  )}
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString('cs-CZ')}</td>
                <td>
                  <div className="table-action-buttons">
                    <button
                      className="btn btn-sm action-btn action-btn-detail"
                      onClick={() => setSelectedUser(user)}
                    >
                      {t('profile.detail')}
                    </button>
                    {!user.profileApproved && (
                      <>
                        <button
                          className="btn btn-sm action-btn action-btn-approve"
                          onClick={() => handleApprove(user.id)}
                        >
                          {t('common.approve')}
                        </button>
                        <button
                          className="btn btn-sm action-btn action-btn-reject"
                          onClick={() => handleReject(user.id)}
                        >
                          {t('common.reject')}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('profile.profileDetails')}: {selectedUser.username}</h3>
              <button className="btn-close" onClick={() => setSelectedUser(null)} aria-label={t('common.close')}>×</button>
            </div>
            <div className="modal-body">
              <div className="profile-section">
                <h4>{t('profile.basicInfo')}</h4>
                <p><strong>{t('profile.email')}:</strong> {selectedUser.email}</p>
                <p><strong>{t('profile.role')}:</strong> {selectedUser.role}</p>
                <p><strong>{t('profile.registered')}:</strong> {new Date(selectedUser.createdAt).toLocaleDateString('cs-CZ')}</p>
                <p>
                  <strong>{t('profile.approvalStatus')}:</strong>{' '}
                  {selectedUser.profileApproved ? (
                    <span className="text-success">✅ {t('profile.approved')}</span>
                  ) : (
                    <span className="text-warning">⚠️ {t('profile.pending')}</span>
                  )}
                </p>
                {selectedUser.profileApprovedAt && (
                  <p><strong>{t('profile.approvedDate')}:</strong> {new Date(selectedUser.profileApprovedAt).toLocaleDateString('cs-CZ')}</p>
                )}
              </div>

              <div className="profile-section">
                <h4>{t('profile.bio') || 'Biografie'}</h4>
                {selectedUser.bio && (
                  <p>
                    <strong>Česky:</strong>
                    <br />
                    {selectedUser.bio}
                  </p>
                )}
                {selectedUser.bioEn && (
                  <p>
                    <strong>English:</strong>
                    <br />
                    {selectedUser.bioEn}
                  </p>
                )}
                {!selectedUser.bio && !selectedUser.bioEn && (
                  <p><em>{t('profile.notFilled')}</em></p>
                )}
              </div>

              <div className="profile-section">
                <h4>{t('profile.personalData')}</h4>
                <p><strong>{t('profile.birthNumber')}:</strong> {selectedUser.birthNumber || t('profile.notFilled')}</p>
              </div>

              <div className="profile-section">
                <h4>{t('profile.permanentAddress')}</h4>
                <p><strong>{t('profile.street')}:</strong> {selectedUser.permanentAddress || t('profile.notFilled')}</p>
                <p><strong>{t('profile.city')}:</strong> {selectedUser.permanentCity || t('profile.notFilled')}</p>
                <p><strong>{t('profile.postalCode')}:</strong> {selectedUser.permanentPostalCode || t('profile.notFilled')}</p>
                <p><strong>{t('profile.country')}:</strong> {selectedUser.country || t('profile.notFilled')}</p>
              </div>

              <div className="profile-section">
                <h4>{t('profile.correspondenceAddress')}</h4>
                <p><strong>{t('profile.street')}:</strong> {selectedUser.address || t('profile.notFilled')}</p>
                <p><strong>{t('profile.city')}:</strong> {selectedUser.city || t('profile.notFilled')}</p>
                <p><strong>{t('profile.postalCode')}:</strong> {selectedUser.postalCode || t('profile.notFilled')}</p>
              </div>

              <div className="profile-section">
                <h4>{t('profile.bankingDetails')}</h4>
                <p><strong>{t('profile.accountNumber')}:</strong> {selectedUser.bankAccountNumber || t('profile.notFilled')}</p>
                <p><strong>{t('profile.bankCode')}:</strong> {selectedUser.bankCode || t('profile.notFilled')}</p>
                <p><strong>{t('profile.bankName')}:</strong> {selectedUser.bankName || t('profile.notFilled')}</p>
              </div>

              <div className="modal-actions">
                {!selectedUser.profileApproved && (
                  <>
                    <button
                      className="btn btn-outline-success me-2"
                      onClick={() => handleApprove(selectedUser.id)}
                    >
                      {t('profile.approveProfileButton')}
                    </button>
                    <button
                      className="btn btn-outline-danger me-2"
                      onClick={() => handleReject(selectedUser.id)}
                    >
                      {t('profile.rejectProfileButton')}
                    </button>
                  </>
                )}
                <button className="btn btn-outline-secondary" onClick={() => setSelectedUser(null)}>
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileApprovals;
