import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAppSelector } from '../hooks';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import './AuthorBioEditor.css';

interface ArtworkType {
  id: number;
  name: string;
  name_en: string;
  approved?: boolean;
  approved_at?: string;
}

const AuthorBioEditor: React.FC = () => {
  const { token, user } = useAppSelector(state => state.auth);
  const [bio, setBio] = useState('');
  const [bioApproved, setBioApproved] = useState(false);
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
      const artworkTypes = res.data.artworkTypes || [];
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
      setAvailableTypes(res.data);
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
      const response = await axios.put('/api/auth/profile/author', {
        bio,
        artworkTypeIds: selectedTypeIds
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Profil byl odeslán ke schválení adminem');
      setBioApproved(false); // Profile is now pending
      setTimeout(() => setSuccess(null), 5000);
      
      // Emit custom event to notify other components about profile update
      window.dispatchEvent(new CustomEvent('authorProfileUpdated', { detail: { userId: user?.id } }));
      
      loadProfile();
    } catch (err: any) {
      console.error('Profile update error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Chyba při ukládání profilu';
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="author-bio-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Autorský profil</h2>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={loadProfile}
          title="Znovu načíst profil (např. po schválení adminem)"
        >
          🔄 Obnovit
        </Button>
      </div>
      
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}
      
      {!bioApproved && bio && (
        <Alert variant="warning">
          ⏳ Váš profil čeká na schválení adminem
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <Card.Header>
            <strong>📝 Biografie</strong>
            {bioApproved && <Badge bg="success" className="ms-2">Schváleno</Badge>}
            {!bioApproved && bio && <Badge bg="warning" className="ms-2">Čeká na schválení</Badge>}
          </Card.Header>
          <Card.Body>
            <Form.Group>
              <Form.Label>O vás</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Napište něco o sobě, své tvorbě, inspiraci..."
              />
              <Form.Text className="text-muted">
                Popište sebe a svou tvorbu
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Header>
            <strong>🎨 Typy uměleckých děl</strong>
          </Card.Header>
          <Card.Body>
            <Form.Text className="text-muted d-block mb-3">
              Vyberte typy děl, které tvoříte. Po schválení adminem budete moci vytvářet díla těchto typů.
            </Form.Text>
            
            <div className="artwork-types-grid">
              {availableTypes.map(type => {
                const isSelected = selectedTypeIds.includes(type.id);
                const userType = userTypes.find(ut => ut.id === type.id);
                const isApproved = userType?.approved;

                return (
                  <div 
                    key={type.id}
                    className={`artwork-type-item ${isSelected ? 'selected' : ''} ${isApproved ? 'approved' : ''}`}
                    onClick={() => handleTypeToggle(type.id)}
                  >
                    <Form.Check
                      type="checkbox"
                      id={`type-${type.id}`}
                      label={type.name}
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

        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? '⏳ Ukládám...' : '💾 Uložit profil'}
        </Button>
        
        <Form.Text className="d-block mt-2 text-muted">
          Změny profilu musí být schváleny adminem
        </Form.Text>
      </Form>
    </div>
  );
};

export default AuthorBioEditor;
