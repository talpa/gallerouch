import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Badge from 'react-bootstrap/Badge';
import { useAppSelector } from '../hooks';
import { formatPrice } from '../utils/currency';
import ArtworkImageManager from './ArtworkImageManager';
import ArtworkEventsManager from './ArtworkEventsManager';
import 'bootstrap/dist/css/bootstrap.min.css';
import './AdminGalleryManager.css';
import './ArtworkList.css';
import './UserArtworkManager.css';

type ArtworkStatus = 'skryto' | 'vystaveno' | 'zrušeno';
type ViewMode = 'card' | 'list';

interface Artwork {
  id: number;
  title: string;
  description: string;
  price: number;
  status: ArtworkStatus;
  userId: number;
  userEmail?: string;
  userName?: string;
  imageUrl?: string;
  artworkTypeId?: number;
  artworkTypeName?: string;
  artworkTypeNameEn?: string;
}

const AdminGalleryManager: React.FC = () => {
  const { token, user } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'events'>('details');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStatus, setSelectedStatus] = useState<ArtworkStatus | 'všechny'>('všechny');
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>(user?.id || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    userId: 0,
    artworkTypeId: 0,
    imageFile: null as File | null,
  });
  const [users, setUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [artworkTypes, setArtworkTypes] = useState<Array<{ id: number; name: string; name_en: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadArtworks();
    loadArtworkTypes();
    // Load users list for admin
    if (user?.role === 'admin') {
      loadUsers();
    }
    // Set default userId to current user
    if (user?.id) {
      setFormData(prev => ({ ...prev, userId: user.id }));
      setSelectedUserId(user.id);
    }
  }, [user?.id, user?.role]);

  const loadArtworks = async () => {
    try {
      const res = await axios.get('/api/artworks');
      setArtworks(res.data);
    } catch (err) {
      console.error('Failed to load artworks:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadArtworkTypes = async () => {
    try {
      const res = await axios.get('/api/auth/artwork-types');
      setArtworkTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load artwork types:', err);
    }
  };

  const getStatusTranslation = (status: ArtworkStatus): string => {
    const statusMap: Record<ArtworkStatus, string> = {
      'skryto': t('gallery.hidden') || 'Skryto',
      'vystaveno': t('gallery.exhibited') || 'Vystaveno',
      'zrušeno': t('gallery.cancelled') || 'Zrušeno',
    };
    return statusMap[status] || status;
  };

  // Filtrování bez useMemo - přímé vyhodnocení při každém renderu
  const filteredArtworks = artworks.filter(art => {
    const statusMatch = selectedStatus === 'všechny' || art.status === selectedStatus;
    const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       art.description.toLowerCase().includes(searchTerm.toLowerCase());
    const userMatch = selectedUserId === 'all' || art.userId === selectedUserId;
    return statusMatch && searchMatch && userMatch;
  });

  // Pomocná funkce pro počítání artworks podle statusu s ohledem na aktuální filtry (search + user)
  const getStatusCount = (status: ArtworkStatus | 'všechny'): number => {
    return artworks.filter(art => {
      const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         art.description.toLowerCase().includes(searchTerm.toLowerCase());
      const userMatch = selectedUserId === 'all' || art.userId === selectedUserId;
      const statusMatch = status === 'všechny' || art.status === status;
      return searchMatch && userMatch && statusMatch;
    }).length;
  };

  const handleEdit = (artwork: Artwork) => {
    setEditingArtwork(artwork);
    setFormData({
      title: artwork.title,
      description: artwork.description,
      userId: artwork.userId || user?.id || 0,
      artworkTypeId: artwork.artworkTypeId || 0,
      imageFile: null,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('messages.confirmDelete'))) return;
    
    try {
      await axios.delete(`/api/artworks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadArtworks();
    } catch (err: any) {
      alert(err.response?.data?.error || t('messages.error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const artworkData = {
        title: formData.title,
        description: formData.description,
        userId: user?.role === 'admin' ? formData.userId : user?.id || 0,
        artworkTypeId: formData.artworkTypeId || null,
      };
      
      let artworkId = editingArtwork?.id;

      if (editingArtwork) {
        await axios.put(`/api/artworks/${editingArtwork.id}`, artworkData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } else {
        const res = await axios.post('/api/artworks', artworkData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        artworkId = res.data.id;
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

      // After successful creation/update, reload and keep the artwork open for managing images/events
      await loadArtworks();
      
      if (!editingArtwork && artworkId) {
        // For new artworks, load and set as editing to show images/events tabs
        const res = await axios.get(`/api/artworks`);
        const newArtwork = res.data.find((a: Artwork) => a.id === artworkId);
        if (newArtwork) {
          setEditingArtwork(newArtwork);
          setActiveTab('images');
        }
      } else {
        setShowModal(false);
        setActiveTab('details');
        setEditingArtwork(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || t('messages.error'));
    }
  };

  const handleNewArtwork = () => {
    setEditingArtwork(null);
    setFormData({
      title: '',
      description: '',
      userId: user?.id || 0,
      artworkTypeId: 0,
      imageFile: null,
    });
    setShowModal(true);
  };

  return (
    <div className="user-artwork-manager">
      <h2>{t('account.adminGallery')}</h2>
      
      <div className="mb-3">
        <Button variant="success" onClick={handleNewArtwork}>{t('gallery.newArtwork')}</Button>
        {' '}
        <Button variant="primary" onClick={loadArtworks}>🔄 {t('buttons.refresh')}</Button>
      </div>

      {/* Filtry a kontroly */}
      <div className="gallery-controls mb-3">
        <div className="controls-left">
          <input
            type="text"
            className="gallery-search"
            placeholder={t('account.searchArtworks') || 'Hledat...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="controls-middle">
          {/* User filter - pouze pro admina */}
          <div className="filter-group mb-2">
            <span className="filter-label">{t('gallery.artworkOwner')}:</span>
            <select
              className="user-filter-dropdown"
              value={selectedUserId === 'all' ? 'all' : String(selectedUserId)}
              onChange={e => setSelectedUserId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              aria-label="Filtr podle uživatele"
            >
              <option value="all">{t('account.allUsers') || 'Všichni uživatelé'}</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'všechny' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('všechny')}
            >
              {t('gallery.allStatuses')} ({getStatusCount('všechny')})
            </button>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'skryto' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('skryto')}
            >
              {t('gallery.hiddenShort')} ({getStatusCount('skryto')})
            </button>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'vystaveno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('vystaveno')}
            >
              {t('gallery.exhibitedShort')} ({getStatusCount('vystaveno')})
            </button>
            <button
              className={`filter-btn filter-btn-compact ${selectedStatus === 'zrušeno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('zrušeno')}
            >
              {t('gallery.cancelledShort')} ({getStatusCount('zrušeno')})
            </button>
          </div>
        </div>

        <div className="controls-right">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title={t('view.cards') || 'Zobrazení jako dlaždice'}
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('view.list') || 'Zobrazení jako seznam'}
            >
              ≡
            </button>
          </div>
        </div>
      </div>

      <div className="gallery-results-info mb-3">
        {t('gallery.displayed')}: <strong>{filteredArtworks.length}</strong> {t('gallery.of')} <strong>{artworks.length}</strong> {t('gallery.noArtworks')}
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <Table striped bordered hover responsive className="artwork-table" key={`list-${selectedStatus}-${selectedUserId}-${searchTerm.length}`}>
          <thead className="table-dark">
            <tr>
              <th className="artwork-table-id">ID</th>
              <th className="artwork-table-title">{t('gallery.artworkTitle')}</th>
              <th className="artwork-table-type">{t('gallery.artworkType') || 'Typ'}</th>
              <th className="artwork-table-price">{t('gallery.price')}</th>
              <th className="artwork-table-status">{t('gallery.status')}</th>
              <th className="artwork-table-owner">{t('gallery.artworkOwner')}</th>
              <th className="artwork-table-actions">{t('admin.managementUsers')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredArtworks.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  {t('gallery.noArtworks') || 'Žádná díla'}
                </td>
              </tr>
            ) : (
              filteredArtworks.map((art, idx) => (
                <tr key={`${art.id}-${idx}`}>
                  <td>{art.id}</td>
                  <td>{art.title}</td>
                  <td>
                    {art.artworkTypeName ? (
                      <Badge bg="secondary">{art.artworkTypeName}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>{art.price ? `${formatPrice(art.price)}` : '—'}</td>
                  <td>
                    <Badge bg={
                      art.status === 'vystaveno' ? 'success' :
                      art.status === 'zrušeno' ? 'danger' : 'warning'
                    }>
                      {getStatusTranslation(art.status)}
                    </Badge>
                  </td>
                  <td>
                    {art.userName && (
                      <div className="user-link">
                        <div><strong>{art.userName}</strong></div>
                        <div><small className="text-muted">{art.userEmail}</small></div>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="gallery-action-buttons">
                      <Button variant="warning" size="sm" onClick={() => handleEdit(art)} title={t('gallery.edit')}>
                        ✏️ {t('gallery.edit')}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(art.id)} title={t('gallery.delete')}>
                        🗑️ {t('gallery.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <div className="artwork-cards-container" key={`card-${selectedStatus}-${selectedUserId}-${searchTerm.length}`}>
          {filteredArtworks.length === 0 ? (
            <div className="text-center text-muted py-5">
              {t('gallery.noArtworks') || 'Žádná díla'}
            </div>
          ) : (
            filteredArtworks.map((art, idx) => (
              <div key={`card-${art.id}-${idx}`} className="artwork-card">
                {art.imageUrl && (
                  <div className="artwork-card-image">
                    <img src={art.imageUrl} alt={art.title} />
                  </div>
                )}
                <div className="artwork-card-body">
                  <h5 className="artwork-card-title">{art.title}</h5>
                  <p className="artwork-card-text">{art.description}</p>
                  <div className="artwork-card-meta">
                    <div>
                      <Badge bg={
                        art.status === 'vystaveno' ? 'success' :
                        art.status === 'zrušeno' ? 'danger' : 'warning'
                      }>
                        {getStatusTranslation(art.status)}
                      </Badge>
                    </div>
                    <div className="artwork-card-price">{art.price ? `${formatPrice(art.price)}` : '—'}</div>
                  </div>
                  {art.userName && (
                    <div className="artwork-card-owner">
                      <small className="text-muted">{art.userName}</small>
                    </div>
                  )}
                  <div className="artwork-card-actions">
                    <Button variant="warning" size="sm" onClick={() => handleEdit(art)} title={t('gallery.edit')}>
                      ✏️ {t('gallery.edit')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(art.id)} title={t('gallery.delete')}>
                      🗑️ {t('gallery.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingArtwork ? t('gallery.editArtwork') : t('gallery.newArtwork')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k as any)} className="mb-3">
            <Tab eventKey="details" title={t('tabs.basicInfo')}>
              <Form onSubmit={handleSubmit} className="mt-3">
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.artworkTitle')}</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.artworkDescription')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t('gallery.artworkType') || 'Typ uměleckého díla'}</Form.Label>
                  <Form.Select
                     value={formData.artworkTypeId.toString()}
                     onChange={e => setFormData({ ...formData, artworkTypeId: parseInt(e.target.value) || 0 })}
                  >
                     <option value="0">-- {t('gallery.selectType') || 'Vyberte typ'} --</option>
                    {artworkTypes.map(type => (
                       <option key={type.id} value={type.id.toString()}>
                        {type.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                {user?.role === 'admin' && (
                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.artworkOwner')}</Form.Label>
                    <Form.Select
                      value={formData.userId}
                      onChange={e => setFormData({ ...formData, userId: parseInt(e.target.value) })}
                    >
                      <option value={0}>-- {t('admin.managementUsers')} --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                )}
                <Button variant="success" type="submit">
                  {editingArtwork ? `💾 ${t('buttons.save')}` : `✅ ${t('buttons.create')}`}
                </Button>
              </Form>
            </Tab>

            {editingArtwork && (
              <Tab eventKey="images" title={t('tabs.images')}>
                <div className="mt-3">
                  <ArtworkImageManager 
                    artworkId={editingArtwork.id} 
                    onImagesUpdated={() => loadArtworks()}
                  />
                </div>
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

export default AdminGalleryManager;
