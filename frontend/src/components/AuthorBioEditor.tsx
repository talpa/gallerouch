import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAppSelector } from '../hooks';
import { useTranslation } from 'react-i18next';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import { normalizeArrayPayload } from '../utils/apiPayload';
import './AuthorBioEditor.css';

interface ArtworkType {
  id: number;
  name: string;
  name_en: string;
  approved?: boolean;
  approved_at?: string;
}

interface AuthorBioEditorProps {
  mode?: 'all' | 'bio' | 'types';
}

const AuthorBioEditor: React.FC<AuthorBioEditorProps> = ({ mode = 'all' }) => {
  const { token, user } = useAppSelector(state => state.auth);
  const { t, i18n } = useTranslation();
  const showBioSection = mode === 'all' || mode === 'bio';
  const showTypesSection = mode === 'all' || mode === 'types';
  const [bio, setBio] = useState('');
  const [bioApproved, setBioApproved] = useState(false);
  const [bioEn, setBioEn] = useState('');
  const [bioEnApproved, setBioEnApproved] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<ArtworkType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);
  const [userTypes, setUserTypes] = useState<ArtworkType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBio(res.data.bio || '');
      setBioApproved(res.data.bio_approved || false);
      setBioEn(res.data.bio_en || '');
      setBioEnApproved(res.data.bio_en_approved || false);
      const artworkTypes = normalizeArrayPayload<ArtworkType>(res.data.artworkTypes);
      setUserTypes(artworkTypes);
      
      // Pre-select artwork types (both approved and pending)
      const typeIds = artworkTypes.map((t: ArtworkType) => t.id);
      setSelectedTypeIds(typeIds);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, [token]);

  const loadArtworkTypes = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/artwork-types');
      setAvailableTypes(normalizeArrayPayload<ArtworkType>(res.data));
    } catch (err) {
      console.error('Failed to load artwork types:', err);
    }
  }, []);

  // Load profile and artwork types when component mounts or token changes
  useEffect(() => {
    if (token) {
      loadProfile();
      loadArtworkTypes();
    }
  }, [token, loadProfile, loadArtworkTypes]);

  // Reload profile when window gets focus (after admin approval)
  useEffect(() => {
    const handleFocus = () => {
      if (token) {
        loadProfile();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token, loadProfile]);

  const handleTypeToggle = (typeId: number) => {
    if (selectedTypeIds.includes(typeId)) {
      setSelectedTypeIds(selectedTypeIds.filter(id => id !== typeId));
    } else {
      setSelectedTypeIds([...selectedTypeIds, typeId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: { bio?: string; bioEn?: string; artworkTypeIds?: number[] } = {};
      if (showBioSection) {
        payload.bio = bio;
        payload.bioEn = bioEn;
      }
      if (showTypesSection) {
        payload.artworkTypeIds = selectedTypeIds;
      }

      await axios.put('/api/auth/profile/author', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(t('authorBio.profileSubmitted'));
      if (showBioSection) {
        setBioApproved(false); // Profile is now pending
        setBioEnApproved(false); // Profile is now pending
      }
      setTimeout(() => setSuccess(null), 5000);
      
      // Emit custom event to notify other components about profile update
      window.dispatchEvent(new CustomEvent('authorProfileUpdated', { detail: { userId: user?.id } }));
      
      loadProfile();
    } catch (err: any) {
      console.error('Profile update error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || t('messages.error');
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="author-bio-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{t('authorBio.authorProfile')}</h2>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={loadProfile}
          title={t('authorBio.refreshTooltip')}
        >
          {t('authorBio.refresh')}
        </Button>
      </div>
      
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}
      
      {showBioSection && !bioApproved && bio && (
        <Alert variant="warning">
          {t('authorBio.pendingApproval')}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        {showBioSection && (
        <Card className="mb-4">
          <Card.Header>
            <strong>{t('authorBio.biography')}</strong>
          </Card.Header>
          <Card.Body>
            {/* Czech Biography */}
            <Form.Group className="mb-4">
              <Form.Label>
                {t('authorBio.biographyCzech')}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('authorBio.aboutYouPlaceholder')}
              />
              <Form.Text className="text-muted">
                {t('authorBio.describeYourself')}
              </Form.Text>
              {bioApproved && <Badge bg="success" className="ms-2 d-inline-block mt-2">{t('authorBio.approved')}</Badge>}
              {!bioApproved && bio && <Badge bg="warning" className="ms-2 d-inline-block mt-2">{t('authorBio.pending')}</Badge>}
            </Form.Group>

            {/* English Biography */}
            <Form.Group>
              <Form.Label>
                {t('authorBio.biographyEnglish')}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={bioEn}
                onChange={(e) => setBioEn(e.target.value)}
                placeholder={t('authorBio.aboutYouPlaceholderEnglish')}
              />
              <Form.Text className="text-muted">
                {t('authorBio.describeYourselfEnglish')}
              </Form.Text>
              {bioEnApproved && <Badge bg="success" className="ms-2 d-inline-block mt-2">{t('authorBio.approved')}</Badge>}
              {!bioEnApproved && bioEn && <Badge bg="warning" className="ms-2 d-inline-block mt-2">{t('authorBio.pending')}</Badge>}
            </Form.Group>
          </Card.Body>
        </Card>
        )}

        {showTypesSection && (
        <Card className="mb-4">
          <Card.Header>
            <strong>{t('authorBio.artworkTypes')}</strong>
          </Card.Header>
          <Card.Body>
            <Form.Text className="text-muted d-block mb-3">
              {t('authorBio.selectArtworkTypes')}
            </Form.Text>
            
            <div className="artwork-types-grid">
              {availableTypes.map(type => {
                const isSelected = selectedTypeIds.includes(type.id);
                const userType = userTypes.find(ut => ut.id === type.id);
                const isApproved = userType?.approved;

                const displayTypeName = i18n.language.startsWith('en')
                  ? (type.name_en || type.name)
                  : type.name;

                return (
                  <div 
                    key={type.id}
                    className={`artwork-type-item ${isSelected ? 'selected' : ''} ${isApproved ? 'approved' : ''}`}
                    onClick={() => handleTypeToggle(type.id)}
                  >
                    <Form.Check
                      type="checkbox"
                      id={`type-${type.id}`}
                      label={displayTypeName}
                      checked={isSelected}
                      onChange={() => {}}
                      className="artwork-type-checkbox"
                    />
                    {isApproved && <Badge bg="success" className="ms-2">✓</Badge>}
                    {!isApproved && isSelected && <Badge bg="warning" className="ms-2">⏳</Badge>}
                  </div>
                );
              })}
            </div>
          </Card.Body>
        </Card>
        )}

        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? t('authorBio.saving') : t('authorBio.saveProfileButton')}
        </Button>
        
        <Form.Text className="d-block mt-2 text-muted">
          {t('authorBio.changesNeedApproval')}
        </Form.Text>
      </Form>
    </div>
  );
};

export default AuthorBioEditor;
