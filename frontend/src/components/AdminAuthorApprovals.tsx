import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../hooks';
import axios from 'axios';
import { Table, Button, Badge, Card, Alert, Spinner, Modal } from 'react-bootstrap';
import './AdminAuthorApprovals.css';

interface UserBio {
  id: number;
  username: string;
  email: string;
  bio?: string;
  bio_en?: string;
  bio_approved: boolean;
  bio_approved_at?: string;
  bio_approved_by?: number;
  bio_en_approved?: boolean;
  bio_en_approved_at?: string;
  bio_en_approved_by?: number;
}

interface ArtworkType {
  id: number;
  name_cs: string;
  name_en: string;
}

interface UserArtworkType {
  user_id: number;
  username: string;
  email: string;
  artwork_type_id: number;
  type_name_cs: string;
  type_name_en: string;
  approved: boolean;
  approved_at?: string;
  approved_by?: number;
}

const AdminAuthorApprovals: React.FC = () => {
  const { token } = useAppSelector(state => state.auth);
  const { t, i18n } = useTranslation();
  const [pendingBios, setPendingBios] = useState<UserBio[]>([]);
  const [pendingTypes, setPendingTypes] = useState<UserArtworkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBio, setSelectedBio] = useState<UserBio | null>(null);
  const [showBioModal, setShowBioModal] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      // Fetch pending profiles (bio and artwork types)
      const response = await axios.get('/api/auth/pending-profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const users = response.data;
      
      // Extract users with pending bios
      const pendingBioUsers = users
        .filter((user: any) => {
          const hasPendingCsBio = !!user.bio && !user.bio_approved;
          const hasPendingEnBio = !!user.bio_en && !user.bio_en_approved;
          return hasPendingCsBio || hasPendingEnBio;
        })
        .map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          bio: user.bio,
          bio_en: user.bio_en,
          bio_approved: user.bio_approved,
          bio_approved_at: user.bio_approved_at,
          bio_approved_by: user.bio_approved_by,
          bio_en_approved: user.bio_en_approved,
          bio_en_approved_at: user.bio_en_approved_at,
          bio_en_approved_by: user.bio_en_approved_by
        }));
      setPendingBios(pendingBioUsers);

      // Extract pending artwork types
      const pendingArtworkTypes: UserArtworkType[] = [];
      users.forEach((user: any) => {
        if (user.artwork_types && Array.isArray(user.artwork_types)) {
          user.artwork_types
            .filter((type: any) => !type.approved)
            .forEach((type: any) => {
              pendingArtworkTypes.push({
                user_id: user.id,
                username: user.username,
                email: user.email,
                artwork_type_id: type.id,
                type_name_cs: type.name,
                type_name_en: type.name_en,
                approved: type.approved || false,
                approved_at: type.approved_at,
                approved_by: type.approved_by
              });
            });
        }
      });
      setPendingTypes(pendingArtworkTypes);
      
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch pending approvals:', err);
      setError(t('admin.failedFetchPendingApprovals') || 'Nepodařilo se načíst čekající schválení');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBio = async (userId: number) => {
    if (!token) return;
    
    try {
      await axios.post(`/api/auth/profile/${userId}/approve-bio`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowBioModal(false);
      setSelectedBio(null);
      await fetchPendingApprovals();
    } catch (err) {
      console.error('Failed to approve bio:', err);
      setError(t('admin.failedApproveBio') || 'Nepodařilo se schválit bio');
    }
  };

  const handleRejectBio = async (userId: number) => {
    if (!token) return;
    
    try {
      // Delete the bio by setting it to NULL and marking as rejected
      await axios.post(`/api/auth/profile/${userId}/reject-bio`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowBioModal(false);
      setSelectedBio(null);
      await fetchPendingApprovals();
    } catch (err) {
      console.error('Failed to reject bio:', err);
      setError(t('admin.failedRejectBio') || 'Nepodařilo se zamítnout bio');
    }
  };

  const handleApproveArtworkType = async (userId: number, typeId: number) => {
    if (!token) return;
    
    try {
      await axios.post(`/api/auth/profile/${userId}/approve-artwork-type/${typeId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchPendingApprovals();
    } catch (err) {
      console.error('Failed to approve artwork type:', err);
      setError(t('admin.failedApproveType') || 'Nepodařilo se schválit typ díla');
    }
  };

  const handleRejectArtworkType = async (userId: number, typeId: number) => {
    if (!token) return;
    
    try {
      await axios.post(`/api/auth/profile/${userId}/reject-artwork-type/${typeId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchPendingApprovals();
    } catch (err) {
      console.error('Failed to reject artwork type:', err);
      setError(t('admin.failedRejectType') || 'Nepodařilo se zamítnout typ díla');
    }
  };

  const openBioModal = (user: UserBio) => {
    setSelectedBio(user);
    setShowBioModal(true);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </Spinner>
      </div>
    );
  }

  const totalPending = pendingBios.length + pendingTypes.length;

  return (
    <div className="admin-author-approvals">
      <h2>{t('admin.authorApprovals') || 'Schvalování autorských profilů'}</h2>
      
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      
      {totalPending === 0 ? (
        <Alert variant="info">
          {t('admin.noPendingApprovals') || 'Žádné čekající schválení autorských profilů'}
        </Alert>
      ) : (
        <Alert variant="warning">
          {t('admin.pendingApprovalsCount') || 'Čekající schválení'}: <strong>{totalPending}</strong>
          {' '}({pendingBios.length} bio, {pendingTypes.length} {t('admin.artworkTypes') || 'typy děl'})
        </Alert>
      )}

      {/* Pending Bios Section */}
      {pendingBios.length > 0 && (
        <Card className="mb-4">
          <Card.Header>
            <h4>{t('admin.pendingBios') || 'Čekající biografie'} ({pendingBios.length})</h4>
          </Card.Header>
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>{t('common.username')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.bio')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingBios.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <div style={{ maxWidth: '500px', whiteSpace: 'pre-wrap' }}>
                        <div>
                          <strong>CS:</strong>{' '}
                          {user.bio
                            ? (user.bio.length > 100 ? `${user.bio.substring(0, 100)}...` : user.bio)
                            : <em>{t('profile.notFilled')}</em>}
                        </div>
                        <div className="mt-2">
                          <strong>EN:</strong>{' '}
                          {user.bio_en
                            ? (user.bio_en.length > 100 ? `${user.bio_en.substring(0, 100)}...` : user.bio_en)
                            : <em>{t('profile.notFilled')}</em>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <Button 
                        size="sm" 
                        variant="light"
                        className="me-2 compact-action-btn compact-detail-btn"
                        onClick={() => openBioModal(user)}
                      >
                        {t('common.detail')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="light"
                        className="me-2 compact-action-btn compact-approve-btn"
                        onClick={() => handleApproveBio(user.id)}
                      >
                        {t('common.approve')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="light"
                        className="compact-action-btn compact-reject-btn"
                        onClick={() => handleRejectBio(user.id)}
                      >
                        {t('common.reject')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Pending Artwork Types Section */}
      {pendingTypes.length > 0 && (
        <Card>
          <Card.Header>
            <h4>{t('admin.pendingArtworkTypes') || 'Čekající typy děl'} ({pendingTypes.length})</h4>
          </Card.Header>
          <Card.Body>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>{t('common.username')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.artworkType')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingTypes.map(item => (
                  <tr key={`${item.user_id}-${item.artwork_type_id}`}>
                    <td>{item.username}</td>
                    <td>{item.email}</td>
                    <td>
                      <Badge bg="secondary">
                        {i18n.language === 'cs' ? item.type_name_cs : item.type_name_en}
                      </Badge>
                    </td>
                    <td>
                      <Button 
                        size="sm" 
                        variant="light"
                        className="me-2 compact-action-btn compact-approve-btn"
                        onClick={() => handleApproveArtworkType(item.user_id, item.artwork_type_id)}
                      >
                        {t('common.approve')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="light"
                        className="compact-action-btn compact-reject-btn"
                        onClick={() => handleRejectArtworkType(item.user_id, item.artwork_type_id)}
                      >
                        {t('common.reject')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Bio Detail Modal */}
      <Modal show={showBioModal} onHide={() => setShowBioModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('admin.bioDetail') || 'Detail biografie'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBio && (
            <>
              <p><strong>{t('common.username')}:</strong> {selectedBio.username}</p>
              <p><strong>{t('common.email')}:</strong> {selectedBio.email}</p>
              <hr />
              <h5>{t('common.bio')}:</h5>
              <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>CS:</strong>
                  <div>{selectedBio.bio || t('profile.notFilled')}</div>
                </div>
                <div className="mt-3" style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>EN:</strong>
                  <div>{selectedBio.bio_en || t('profile.notFilled')}</div>
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowBioModal(false)}>
            {t('common.close')}
          </Button>
          {selectedBio && (
            <>
              <Button variant="outline-success" onClick={() => handleApproveBio(selectedBio.id)}>
                {t('common.approve')}
              </Button>
              <Button variant="outline-danger" onClick={() => handleRejectBio(selectedBio.id)}>
                {t('common.reject')}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminAuthorApprovals;
