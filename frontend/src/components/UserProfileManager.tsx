import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../hooks';
import axios from 'axios';
import './UserProfileManager.css';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  address?: string;
  city?: string;
  postal_code?: string;
  birth_number?: string;
  permanent_address?: string;
  permanent_city?: string;
  permanent_postal_code?: string;
  country?: string;
  bank_account_number?: string;
  bank_code?: string;
  bank_name?: string;
  profile_approved?: boolean;
  profile_approved_at?: string;
  profile_approved_by?: number;
}

const UserProfileManager: React.FC = () => {
  const { user, token } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    postal_code: '',
    birth_number: '',
    permanent_address: '',
    permanent_city: '',
    permanent_postal_code: '',
    country: 'Česká republika',
    bank_account_number: '',
    bank_code: '',
    bank_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/profile/banking', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(response.data);
      setFormData({
        address: response.data.address || '',
        city: response.data.city || '',
        postal_code: response.data.postal_code || '',
        birth_number: response.data.birth_number || '',
        permanent_address: response.data.permanent_address || '',
        permanent_city: response.data.permanent_city || '',
        permanent_postal_code: response.data.permanent_postal_code || '',
        country: response.data.country || 'Česká republika',
        bank_account_number: response.data.bank_account_number || '',
        bank_code: response.data.bank_code || '',
        bank_name: response.data.bank_name || '',
      });
      setError('');
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError(t('profile.failedLoadProfile'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.put('/api/auth/profile/banking', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(t('messages.profileUpdated'));
      setIsEditing(false);
      fetchProfile();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(t('profile.failedUpdateProfile'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return <div className="user-profile-manager"><p>{t('common.loading')}</p></div>;
  }

  if (!profile) {
    return <div className="user-profile-manager"><p>{t('profile.profileNotFound')}</p></div>;
  }

  return (
    <div className="user-profile-manager">
      <h2>{t('profile.myProfile')}</h2>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!isEditing ? (
        <div className="profile-view">
          {profile.profile_approved === false && (
            <div className="alert alert-warning">
              <strong>{t('profile.approvalPending')}</strong>
              <p>{t('profile.approvalPendingMessage')}</p>
            </div>
          )}
          {profile.profile_approved === true && (
            <div className="alert alert-success">
              <strong>{t('profile.approved')}</strong>
              {profile.profile_approved_at && (
                <p className="mb-0">{t('profile.approvedDate')}: {new Date(profile.profile_approved_at).toLocaleDateString('cs-CZ')}</p>
              )}
            </div>
          )}

          <div className="profile-section">
            <h3>{t('profile.basicInfo')}</h3>
            <p><strong>{t('profile.username')}:</strong> {profile.username}</p>
            <p><strong>{t('profile.email')}:</strong> {profile.email}</p>
          </div>

          <div className="profile-section">
            <h3>{t('profile.personalData')}</h3>
            <p><strong>{t('profile.birthNumber')}:</strong> {profile.birth_number || t('profile.notFilled')}</p>
            <p><strong>{t('profile.approvalStatus')}:</strong> {profile.profile_approved ? t('profile.approved') : t('profile.pending')}</p>
          </div>

          <div className="profile-section">
            <h3>{t('profile.permanentAddress')}</h3>
            <p><strong>{t('profile.street')}:</strong> {profile.permanent_address || t('profile.notFilled')}</p>
            <p><strong>{t('profile.city')}:</strong> {profile.permanent_city || t('profile.notFilled')}</p>
            <p><strong>{t('profile.postalCode')}:</strong> {profile.permanent_postal_code || t('profile.notFilled')}</p>
            <p><strong>{t('profile.country')}:</strong> {profile.country || t('profile.notFilled')}</p>
          </div>

          <div className="profile-section">
            <h3>{t('profile.correspondenceAddress')}</h3>
            <p><strong>{t('profile.street')}:</strong> {profile.address || t('profile.notFilled')}</p>
            <p><strong>{t('profile.city')}:</strong> {profile.city || t('profile.notFilled')}</p>
            <p><strong>{t('profile.postalCode')}:</strong> {profile.postal_code || t('profile.notFilled')}</p>
          </div>

          <div className="profile-section">
            <h3>{t('profile.bankingDetails')}</h3>
            <p><strong>{t('profile.accountNumber')}:</strong> {profile.bank_account_number || t('profile.notFilled')}</p>
            <p><strong>{t('profile.bankCode')}:</strong> {profile.bank_code || t('profile.notFilled')}</p>
            <p><strong>{t('profile.bankName')}:</strong> {profile.bank_name || t('profile.notFilled')}</p>
          </div>

          <button
            className="btn btn-primary mt-3"
            onClick={() => setIsEditing(true)}
          >
            {t('profile.editProfile')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h3>{t('profile.personalData')}</h3>
            <div className="mb-3">
              <label className="form-label">{t('profile.birthNumber')}:</label>
              <input
                type="text"
                name="birth_number"
                className="form-control"
                value={formData.birth_number}
                onChange={handleInputChange}
                placeholder={t('profile.birthNumberPlaceholder')}
                maxLength={11}
              />
              <small className="form-text text-muted">{t('profile.birthNumberFormat')}</small>
            </div>
          </div>

          <div className="form-section">
            <h3>{t('profile.permanentAddress')}</h3>
            <div className="mb-3">
              <label className="form-label">{t('profile.street')}:</label>
              <input
                type="text"
                name="permanent_address"
                className="form-control"
                value={formData.permanent_address}
                onChange={handleInputChange}
                placeholder={t('profile.streetPlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.city')}:</label>
              <input
                type="text"
                name="permanent_city"
                className="form-control"
                value={formData.permanent_city}
                onChange={handleInputChange}
                placeholder={t('profile.cityPlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.postalCode')}:</label>
              <input
                type="text"
                name="permanent_postal_code"
                className="form-control"
                value={formData.permanent_postal_code}
                onChange={handleInputChange}
                placeholder={t('profile.postalCodePlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.country')}:</label>
              <input
                type="text"
                name="country"
                className="form-control"
                value={formData.country}
                onChange={handleInputChange}
                placeholder={t('profile.countryPlaceholder')}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>{t('profile.correspondenceAddress')}</h3>
            <div className="mb-3">
              <label className="form-label">{t('profile.street')}:</label>
              <input
                type="text"
                name="address"
                className="form-control"
                value={formData.address}
                onChange={handleInputChange}
                placeholder={t('profile.streetPlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.city')}:</label>
              <input
                type="text"
                name="city"
                className="form-control"
                value={formData.city}
                onChange={handleInputChange}
                placeholder={t('profile.cityPlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.postalCode')}:</label>
              <input
                type="text"
                name="postal_code"
                className="form-control"
                value={formData.postal_code}
                onChange={handleInputChange}
                placeholder={t('profile.postalCodePlaceholder')}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>{t('profile.bankingDetails')}</h3>
            <div className="mb-3">
              <label className="form-label">{t('profile.accountNumber')}:</label>
              <input
                type="text"
                name="bank_account_number"
                className="form-control"
                value={formData.bank_account_number}
                onChange={handleInputChange}
                placeholder={t('profile.accountNumberPlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.bankCode')}:</label>
              <input
                type="text"
                name="bank_code"
                className="form-control"
                value={formData.bank_code}
                onChange={handleInputChange}
                placeholder={t('profile.bankCodePlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">{t('profile.bankName')}:</label>
              <input
                type="text"
                name="bank_name"
                className="form-control"
                value={formData.bank_name}
                onChange={handleInputChange}
                placeholder={t('profile.bankNamePlaceholder')}
              />
            </div>
          </div>

          <div className="button-group">
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? t('profile.saving') : t('buttons.save')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditing(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UserProfileManager;
