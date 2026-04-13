import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { fetchArtworks } from '../api/artworks';
import { formatPrice } from '../utils/currency';
import { normalizeArrayPayload } from '../utils/apiPayload';
import { Modal, Button, Form, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import ArtworkImageManager from './ArtworkImageManager';
import ArtworkEventsManager from './ArtworkEventsManager';
import './UserGalleryBrowser.css';

interface User {
  id: number;
  username: string;
  email: string;
  count: number;
}

interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  status: string;
  approvedDateTime?: string;
  userEmail?: string;
  userName?: string;
  userId?: number;
  artworkTypeId?: number;
  artworkTypeName?: string;
  artworkTypeNameEn?: string;
}

interface ArtworkType {
  id: number;
  name: string;
  name_en: string;
}

type BrowseMode = 'authors' | 'owners';
type ArtworkStatus = 'skryto' | 'vystaveno' | 'k_prodeji' | 'rezervováno' | 'zrušeno';
type ViewMode = 'card' | 'list';

const UserGalleryBrowser: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'admin';
  const token = useSelector((state: RootState) => state.auth.token);

  const [browseMode, setBrowseMode] = useState<BrowseMode>('authors');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [allArtworkTypes, setAllArtworkTypes] = useState<ArtworkType[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ArtworkStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'events'>('details');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    artworkTypeId: 0
  });

  // Load users
  const loadUsers = async () => {
    try {
      setLoading(true);
      const endpoint = browseMode === 'authors' ? '/api/artworks/authors' : '/api/artworks/owners';
      const response = await axios.get(endpoint);
      setUsers(normalizeArrayPayload<User>(response.data));
      
      // Load all artwork types for edit modal
      const typesRes = await axios.get('/api/auth/artwork-types');
      setAllArtworkTypes(normalizeArrayPayload<ArtworkType>(typesRes.data));
    } catch (err: any) {
      setError(err?.message || t('messages.error'));
    } finally {
      setLoading(false);
    }
  };

  // Load artworks for selected user
  const loadArtworksForUser = async (selectedUser: User) => {
    try {
      const endpoint = browseMode === 'authors' 
        ? `/api/artworks/by-author/${selectedUser.id}`
        : `/api/artworks/by-owner/${selectedUser.id}`;
      
      const statusParam = selectedStatus !== 'all' ? `?status=${selectedStatus}` : '';
      const response = await axios.get(endpoint + statusParam);
      setArtworks(normalizeArrayPayload<Artwork>(response.data));
    } catch (err: any) {
      setError(err?.message || t('messages.error'));
      setArtworks([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [browseMode]);

  useEffect(() => {
    if (selectedUser) {
      loadArtworksForUser(selectedUser);
    }
  }, [selectedStatus, selectedUser]);

  const getStatusLabel = (status: string): string => {
    const normalizedStatus = status.replace('_', ' ');
    const statusMap: Record<string, string> = {
      'skryto': t('gallery.statusHidden'),
      'vystaveno': t('gallery.statusExhibited'),
      'k prodeji': t('gallery.statusForSale'),
      'rezervováno': t('gallery.statusReserved'),
      'zrušeno': t('gallery.statusCancelled'),
    };
    return statusMap[normalizedStatus] || status;
  };

  const getTypeLabel = (type: { name: string; name_en?: string }): string => {
    return i18n.language.startsWith('en') ? (type.name_en || type.name) : type.name;
  };

  const getArtworkTypeLabel = (art: Artwork): string | undefined => {
    return i18n.language.startsWith('en')
      ? (art.artworkTypeNameEn || art.artworkTypeName)
      : art.artworkTypeName;
  };

  const normalizeStatus = (status: string): string => {
    return status.replaceAll('_', ' ');
  };

  const parseDate = (dateStr: string | Date): Date => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const canEdit = (artwork: Artwork): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.id === artwork.userId;
  };

  // Check if current user can see "skryto" artworks of selected user
  const canSeeHiddenArtworks = (): boolean => {
    // Admin can see all
    if (user?.role === 'admin') return true;
    // User can see their own hidden artworks
    return user?.id === selectedUser?.id;
  };

  // Filter artworks to exclude "skryto" for users viewing other users' galleries
  const visibleArtworks = useMemo(() => {
    if (!selectedUser || canSeeHiddenArtworks()) {
      return artworks;
    }
    return artworks.filter(art => normalizeStatus(art.status) !== 'skryto');
  }, [artworks, selectedUser, user]);

  const handleEdit = (artwork: Artwork, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingArtwork(artwork);
    setEditForm({
      title: artwork.title,
      description: artwork.description,
      artworkTypeId: artwork.artworkTypeId || 0
    });
  };

  const handleCloseEdit = () => {
    setEditingArtwork(null);
  };

  const handleSaveEdit = async () => {
    if (!editingArtwork || !token) return;

    try {
      const updateData: any = {
        title: editForm.title,
        description: editForm.description,
        artworkTypeId: editForm.artworkTypeId || null
      };

      await axios.put(`/api/artworks/${editingArtwork.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (selectedUser) {
        await loadArtworksForUser(selectedUser);
      }
      handleCloseEdit();
    } catch (err: any) {
      console.error('Failed to update artwork:', err);
      alert(err?.response?.data?.error || t('messages.error'));
    }
  };

  if (loading) return <div className="text-center p-5">{t('common.loading')}</div>;

  return (
    <div className="user-gallery-browser">
      {/* Browse Mode Toggle */}
      <div className="browse-mode-toggle mb-4">
        <h3 className="mb-3">{t('gallery.browse') || 'Procházet'}</h3>
        <div className="button-group">
          <Button
            variant={browseMode === 'authors' ? 'primary' : 'outline-primary'}
            onClick={() => setBrowseMode('authors')}
          >
            ✍️ {t('gallery.browseAuthors') || 'Podle autorů'}
          </Button>
          <Button
            variant={browseMode === 'owners' ? 'primary' : 'outline-primary'}
            onClick={() => setBrowseMode('owners')}
          >
            👤 {t('gallery.browseOwners') || 'Podle majitelů'}
          </Button>
        </div>
      </div>

      {/* Users List */}
      <div className="users-section mb-4">
        <h4 className="mb-3">
          {browseMode === 'authors' ? t('gallery.authors') : t('gallery.owners')}
        </h4>
        <div className="users-grid">
          {users.map(u => (
            <button
              key={u.id}
              className={`user-card ${selectedUser?.id === u.id ? 'active' : ''}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="user-name">{u.username}</div>
              {isAdmin && <div className="user-email">{u.email}</div>}
              <div className="user-count">{u.count} {t('gallery.works')}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected User Details */}
      {selectedUser && (
        <>
          {/* Status Filter */}
          <div className="status-filter mb-4">
            <h5 className="mb-2">{t('gallery.status')}</h5>
            <div className="status-buttons">
              <Button
                variant={selectedStatus === 'all' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setSelectedStatus('all')}
              >
                {t('gallery.all')} ({selectedUser.count})
              </Button>
              <Button
                variant={selectedStatus === 'k_prodeji' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setSelectedStatus('k_prodeji')}
              >
                {t('gallery.statusForSale')}
              </Button>
              <Button
                variant={selectedStatus === 'vystaveno' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setSelectedStatus('vystaveno')}
              >
                {t('gallery.statusExhibited')}
              </Button>
              <Button
                variant={selectedStatus === 'skryto' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setSelectedStatus('skryto')}
              >
                {t('gallery.statusHidden')}
              </Button>
              <Button
                variant={selectedStatus === 'rezervováno' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setSelectedStatus('rezervováno')}
              >
                {t('gallery.statusReserved')}
              </Button>
            </div>
          </div>

          {/* View Controls */}
          <div className="view-controls mb-4">
            <div className="view-toggle">
              <Button
                variant={viewMode === 'card' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setViewMode('card')}
              >
                ⊞ {t('gallery.cardView')}
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                ≡ {t('gallery.listView')}
              </Button>
            </div>
          </div>

          {/* Artworks Display */}
          {visibleArtworks.length === 0 ? (
            <div className="text-center p-5 text-muted">
              {t('gallery.notFound')}
            </div>
          ) : viewMode === 'card' ? (
            <div className="artwork-grid">
              {visibleArtworks.map(art => {
                const normalizedStatus = normalizeStatus(art.status);
                return (
                  <div
                    key={art.id}
                    className={`artwork-card artwork-${normalizedStatus.replace(' ', '-')}`}
                    onClick={() => navigate(`/artwork/${art.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-image-wrapper">
                      <img src={art.imageUrl} alt={art.title} className="card-image" />
                      <div className={`status-badge status-${normalizedStatus.replace(' ', '-')}`}>
                        {getStatusLabel(normalizedStatus)}
                      </div>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">{art.title}</h3>
                        {getArtworkTypeLabel(art) && (
                        <div className="mb-2">
                            <span className="badge bg-secondary">{getArtworkTypeLabel(art)}</span>
                        </div>
                      )}
                      <p className="card-description">{art.description}</p>
                      <div className="card-footer">
                        <span className="card-price">{formatPrice(art.price)}</span>
                        <span className="card-date">{parseDate(art.approvedDateTime || new Date().toISOString()).toLocaleDateString('cs-CZ')}</span>
                      </div>
                      {canEdit(art) && (
                        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={(e) => handleEdit(art, e)}
                          >
                            ✏️ {t('gallery.edit')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="artwork-list">
              {visibleArtworks.map(art => {
                const normalizedStatus = normalizeStatus(art.status);
                return (
                  <div
                    key={art.id}
                    className={`artwork-row artwork-${normalizedStatus.replace(' ', '-')}`}
                    onClick={() => navigate(`/artwork/${art.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img src={art.imageUrl} alt={art.title} className="row-image" />
                    <div className="row-content">
                      <h4>{art.title}</h4>
                      {getArtworkTypeLabel(art) && (
                        <span className="badge bg-secondary me-2">{getArtworkTypeLabel(art)}</span>
                      )}
                      <p className="row-description">{art.description}</p>
                    </div>
                    <div className="row-meta">
                      <div className={`row-status status-${normalizedStatus.replace(' ', '-')}`}>
                        {getStatusLabel(normalizedStatus)}
                      </div>
                      <div className="row-price">{formatPrice(art.price)}</div>
                      {canEdit(art) && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={(e) => handleEdit(art, e)}
                        >
                          ✏️ {t('gallery.edit')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingArtwork && (
        <Modal show={true} onHide={handleCloseEdit} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{t('gallery.editArtworkModal')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k as any)} className="mb-3">
              <Tab eventKey="details" title={t('common.details')}>
                <Form className="mt-3">
                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.fieldTitle')}</Form.Label>
                    <Form.Control
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.fieldDescription')}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.artworkType')}</Form.Label>
                    <Form.Select
                      value={editForm.artworkTypeId}
                      onChange={(e) => setEditForm({ ...editForm, artworkTypeId: parseInt(e.target.value) })}
                    >
                      <option value="0">{t('gallery.selectType')}</option>
                      {allArtworkTypes.map(type => (
                        <option key={type.id} value={type.id}>{getTypeLabel(type)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Form>
              </Tab>
              <Tab eventKey="images" title={t('common.images')}>
                {editingArtwork && <ArtworkImageManager artworkId={Number(editingArtwork.id)} />}
              </Tab>
              <Tab eventKey="events" title={t('events.events')}>
                {editingArtwork && <ArtworkEventsManager artworkId={Number(editingArtwork.id)} />}
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEdit}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSaveEdit}>{t('common.save')}</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default UserGalleryBrowser;
