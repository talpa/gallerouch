import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Badge from 'react-bootstrap/Badge';
import { useAppSelector } from '../hooks';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../utils/currency';
import ArtworkImageManager from './ArtworkImageManager';
import ArtworkEventsManager from './ArtworkEventsManager';
import 'bootstrap/dist/css/bootstrap.min.css';
import './AdminGalleryManager.css';
import './ArtworkList.css';
import './UserArtworkManager.css';

type ArtworkStatus = 'skryto' | 'vystaveno' | 'zrušeno';
type BrowseMode = 'owner' | 'author';
type ViewMode = 'card' | 'list';

interface UserArtwork {
  id: number;
  title: string;
  description: string;
  price: number;
  status: ArtworkStatus;
  imageUrl?: string;
  userId: number;
}

const UserArtworkManager: React.FC = () => {
  const { token, user } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const [artworks, setArtworks] = useState<UserArtwork[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState<UserArtwork | null>(null);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStatus, setSelectedStatus] = useState<ArtworkStatus | 'všechny'>('všechny');
  const [searchTerm, setSearchTerm] = useState('');
  const [artworkTypes, setArtworkTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [approvedArtworkTypes, setApprovedArtworkTypes] = useState<number[]>([]);
  const [browseMode, setBrowseMode] = useState<BrowseMode>('owner');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    authorId: 0,
    artworkTypeId: 0,
    imageFile: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getStatusLabel = (status: ArtworkStatus): string => {
    const statusMap: Record<ArtworkStatus, string> = {
      skryto: t('gallery.statusHidden'),
      vystaveno: t('gallery.statusExhibited'),
      zrušeno: t('gallery.statusCancelled'),
    };
    return statusMap[status] || status;
  };

  useEffect(() => {
    loadArtworks();
    loadUsers();
    loadArtworkTypes();
    loadUserArtworkTypes();
  }, []);

  useEffect(() => {
    // Reload artworks when toggling between owner/author views
    if (!user?.id) return;
    if (browseMode === 'owner') {
      loadArtworks();
    } else {
      loadAuthoredArtworks();
    }
  }, [browseMode, user?.id]);

  const loadArtworkTypes = async () => {
    try {
      const res = await axios.get('/api/auth/artwork-types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArtworkTypes(res.data);
    } catch (err) {
      console.error('Failed to load artwork types:', err);
    }
  };

  const loadUserArtworkTypes = async () => {
    try {
      const res = await axios.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Načti schválené typy (approved = true)
      const approvedIds = res.data.artworkTypes
        ?.filter((t: any) => t.approved)
        .map((t: any) => t.id) || [];
      setApprovedArtworkTypes(approvedIds);
    } catch (err) {
      console.error('Failed to load user artwork types:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
      // Fallback - pokud endpoint neexistuje, nebude fatální
    }
  };

  const loadArtworks = async () => {
    try {
      const res = await axios.get('/api/artworks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filtruj jen artwork aktuálního uživatele
      const userArtworks = res.data.filter((art: any) => art.userId === user?.id);
      setArtworks(userArtworks);
    } catch (err) {
      console.error('Failed to load artworks:', err);
    }
  };

  const loadAuthoredArtworks = async () => {
    try {
      const res = await axios.get(`/api/artworks/by-author/${user?.id}`);
      setArtworks(res.data);
    } catch (err) {
      console.error('Failed to load authored artworks:', err);
    }
  };

  // Filtrované artworky
  const filteredArtworks = useMemo(() => {
    return artworks.filter(art => {
      const statusMatch = selectedStatus === 'všechny' || art.status === selectedStatus;
      const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         art.description.toLowerCase().includes(searchTerm.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [artworks, selectedStatus, searchTerm]);

  const handleEdit = (artwork: UserArtwork) => {
    // Prevent editing if current user is not the owner anymore
    if (artwork.userId !== (user?.id || 0)) {
      setError(t('gallery.editNotAllowed'));
      return;
    }
    setEditingArtwork(artwork);
    setFormData({
      title: artwork.title,
      description: artwork.description,
      authorId: artwork.userId || user?.id || 0,
      artworkTypeId: 0,
      imageFile: null,
    });
    setActiveTab('details');
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    const art = artworks.find(a => a.id === id);
    if (art && art.userId !== (user?.id || 0)) {
      setError(t('gallery.deleteNotAllowed'));
      return;
    }
    if (!window.confirm(t('gallery.confirmDeleteArtwork'))) return;
    
    try {
      await axios.delete(`/api/artworks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(t('messages.artworkDeleted'));
      setTimeout(() => setSuccess(null), 3000);
      loadArtworks();
    } catch (err: any) {
      setError(err.response?.data?.error || t('messages.error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      let artworkId = editingArtwork?.id;
      const artworkData = {
        title: formData.title,
        description: formData.description,
        authorId: formData.authorId || user?.id,
        artworkTypeId: formData.artworkTypeId || null,
      };

      // Create or update artwork first
      if (editingArtwork) {
        await axios.put(`/api/artworks/${editingArtwork.id}`, artworkData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        setSuccess(t('messages.artworkUpdated'));
      } else {
        const res = await axios.post('/api/artworks', artworkData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        artworkId = res.data.id;
        setSuccess(t('messages.artworkCreated'));
      }

      // Upload image if provided
      if (formData.imageFile && artworkId) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.imageFile);
        
        await axios.post(`/api/upload/${artworkId}`, uploadFormData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setTimeout(() => setSuccess(null), 3000);
      setShowModal(false);
      setEditingArtwork(null);
      loadArtworks();
    } catch (err: any) {
      setError(err.response?.data?.error || t('messages.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleNewArtwork = () => {
    setEditingArtwork(null);
    setFormData({
      title: '',
      description: '',
      authorId: user?.id || 0,
      artworkTypeId: 0,
      imageFile: null,
    });
    setActiveTab('details');
    setShowModal(true);
  };

  return (
    <div className="user-artwork-manager">
      <h2>{t('account.myArtworks')}</h2>
      
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}
      
      <div className="mb-3 d-flex gap-2 align-items-center">
        <Button variant="success" onClick={handleNewArtwork}>{t('gallery.newArtwork')}</Button>
        <div className="ms-auto view-toggle-compact">
          <button
            className={`view-btn ${browseMode === 'owner' ? 'active' : ''}`}
            onClick={() => setBrowseMode('owner')}
            title={t('gallery.owner') || 'Majitel'}
          >
            👤 {t('gallery.owner') || 'Majitel'}
          </button>
          <button
            className={`view-btn ${browseMode === 'author' ? 'active' : ''}`}
            onClick={() => setBrowseMode('author')}
            title={t('gallery.author') || 'Autor'}
          >
            ✍️ {t('gallery.author') || 'Autor'}
          </button>
        </div>
      </div>

      {/* Filtry a kontroly */}
      <div className="gallery-controls mb-3">
        <div className="controls-left">
          <input
            type="text"
            className="gallery-search"
            placeholder={t('gallery.searchArtworks')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="controls-middle">
          <div className="filter-group">
            <span className="filter-label">{t('gallery.status')}:</span>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'všechny' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('všechny')}
            >
              {t('gallery.all')} ({artworks.length})
            </button>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'skryto' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('skryto')}
            >
              {t('gallery.hiddenShort')} ({artworks.filter(a => a.status === 'skryto').length})
            </button>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'vystaveno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('vystaveno')}
            >
              {t('gallery.exhibitedShort')} ({artworks.filter(a => a.status === 'vystaveno').length})
            </button>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'zrušeno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('zrušeno')}
            >
              {t('gallery.cancelledShort')} ({artworks.filter(a => a.status === 'zrušeno').length})
            </button>
          </div>
        </div>

        <div className="controls-right">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title={t('view.cards')}
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('view.list')}
            >
              ≡
            </button>
          </div>
        </div>
      </div>

      <div className="gallery-results-info mb-3">
        {t('gallery.displayed')}: <strong>{filteredArtworks.length}</strong> {t('gallery.of')} <strong>{artworks.length}</strong> {t('gallery.works')}
        {browseMode === 'owner'
          ? ` • ${t('gallery.mode')}: ${t('gallery.owner')}`
          : ` • ${t('gallery.mode')}: ${t('gallery.author')}`}
      </div>

      {/* Zobrazení jako seznam */}
      {viewMode === 'list' && (
        <Table striped bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>{t('gallery.artworkTitle')}</th>
              <th>{t('gallery.price')}</th>
              <th>{t('gallery.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredArtworks.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted">{t('gallery.noArtworks')}</td></tr>
            ) : filteredArtworks.map(art => (
              <tr key={art.id}>
                <td>{art.id}</td>
                <td>{art.title}</td>
                <td>{art.price ? `${formatPrice(art.price)}` : '—'}</td>
                <td>
                  <Badge bg={
                    art.status === 'vystaveno' ? 'success' :
                    art.status === 'skryto' ? 'secondary' :
                    art.status === 'zrušeno' ? 'danger' : 'warning'
                  }>
                    {getStatusLabel(art.status)}
                  </Badge>
                </td>
                <td>
                  {browseMode === 'owner' && (
                    <>
                      <Button variant="warning" size="sm" onClick={() => handleEdit(art)} title={t('actions.editArtwork')}>
                        ✏️ {t('common.edit')}
                      </Button>{' '}
                      <Button variant="danger" size="sm" onClick={() => handleDelete(art.id)} title={t('actions.deleteArtwork')}>
                        🗑️ {t('common.delete')}
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Zobrazení jako dlaždice */}
      {viewMode === 'card' && (
        <div className="gallery-grid">
          {filteredArtworks.length === 0 ? (
            <p className="text-center text-muted">{t('gallery.noArtworks')}</p>
          ) : filteredArtworks.map(art => (
            <div key={art.id} className="artwork-card">
              <div className="artwork-image">
                {art.imageUrl ? (
                  <img src={art.imageUrl} alt={art.title} />
                ) : (
                  <div className="no-image">📷</div>
                )}
              </div>
              <div className="artwork-info">
                <h3 className="artwork-title">{art.title}</h3>
                <p className="artwork-description">{art.description}</p>
                <div className="artwork-meta">
                  <span className="artwork-price">{art.price ? `${formatPrice(art.price)}` : '—'}</span>
                  <Badge bg={
                    art.status === 'vystaveno' ? 'success' :
                    art.status === 'skryto' ? 'secondary' :
                    art.status === 'zrušeno' ? 'danger' : 'warning'
                  }>
                    {getStatusLabel(art.status)}
                  </Badge>
                </div>
                <div className="artwork-actions mt-2">
                  {browseMode === 'owner' && (
                    <>
                      <Button variant="warning" size="sm" onClick={() => handleEdit(art)}>
                        ✏️ {t('common.edit')}
                      </Button>{' '}
                      <Button variant="danger" size="sm" onClick={() => handleDelete(art.id)}>
                        🗑️ {t('common.delete')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingArtwork ? t('gallery.editArtwork') : t('gallery.newArtwork')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k as any)} className="mb-3">
            <Tab eventKey="details" title={t('tabs.basicInfo')}>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.fieldTitle')}</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.fieldDescription')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.author')}</Form.Label>
                  <Form.Select
                    value={formData.authorId}
                    onChange={e => setFormData({ ...formData, authorId: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">{t('gallery.selectAuthor')}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {t('gallery.authorHelp')}
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.artworkType')}</Form.Label>
                  <Form.Select
                    value={formData.artworkTypeId}
                    onChange={e => setFormData({ ...formData, artworkTypeId: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">{t('gallery.selectType')}</option>
                    {artworkTypes
                      .filter(t => approvedArtworkTypes.includes(t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {t('gallery.approvedTypesOnly')}
                  </Form.Text>
                </Form.Group>
                <Button variant="success" type="submit" disabled={loading}>
                  {loading ? `⏳ ${t('common.loading')}` : editingArtwork ? `💾 ${t('buttons.save')}` : `✅ ${t('buttons.create')}`}
                </Button>
              </Form>
            </Tab>
            {editingArtwork && (
              <Tab eventKey="images" title={t('tabs.images')}>
                <ArtworkImageManager 
                  artworkId={editingArtwork.id}
                  onImagesUpdated={() => loadArtworks()}
                />
              </Tab>
            )}
            {editingArtwork && (
              <Tab eventKey="events" title={t('tabs.events')}>
                <ArtworkEventsManager 
                  artworkId={editingArtwork.id}
                  onEventsUpdated={() => loadArtworks()}
                />
              </Tab>
            )}
          </Tabs>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default UserArtworkManager;
