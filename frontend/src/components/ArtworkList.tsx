import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { fetchArtworks, fetchArtworkEvents, ArtworkEvent } from '../api/artworks';
import { formatPrice } from '../utils/currency';
import { Modal, Button, Form, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import ArtworkImageManager from './ArtworkImageManager';
import ArtworkEventsManager from './ArtworkEventsManager';
import './ArtworkList.css';

export type ArtworkStatus = 'skryto' | 'vystaveno' | 'k prodeji' | 'rezervováno' | 'zrušeno';
export type ViewMode = 'card' | 'list';

export interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  status: ArtworkStatus;
  approvedDateTime?: string;
  eventType?: string;
  eventStatus?: string;
  userEmail?: string;
  userName?: string;
  userId?: number;
  userBio?: string;
  authorId?: number;
  authorName?: string;
  authorEmail?: string;
  authorBio?: string;
  artworkTypeId?: number;
  artworkTypeName?: string;
  artworkTypeNameEn?: string;
}

const ArtworkList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'admin';
  const token = useSelector((state: RootState) => state.auth.token);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [artworkTypes, setArtworkTypes] = useState<Array<{ id: number; name: string; name_en: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedStatus, setSelectedStatus] = useState<ArtworkStatus | 'všechny'>('všechny');
  const [selectedArtworkType, setSelectedArtworkType] = useState<number | 'všechny'>('všechny');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'events'>('details');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    price: 0,
    status: 'vystaveno' as ArtworkStatus,
    userId: 0,
    artworkTypeId: 0
  });

  // Funkce pro překlad statusu
  const getStatusLabel = (status: ArtworkStatus): string => {
    const statusMap: Record<ArtworkStatus, string> = {
      'skryto': t('gallery.statusHidden'),
      'vystaveno': t('gallery.statusExhibited'),
      'k prodeji': t('gallery.statusForSale'),
      'rezervováno': t('gallery.statusReserved'),
      'zrušeno': t('gallery.statusCancelled'),
    };
    return statusMap[status] || status;
  };

  // Helper pro normalizaci statusu z backendu (lowercase s podtržítky) na frontend formát
  const normalizeStatus = (status: string): ArtworkStatus => {
    const s = status.replaceAll('_', ' ').toLowerCase();
    if (s === 'prodáno') return 'vystaveno';
    return s as ArtworkStatus;
  };

  // Helper pro bezpečné parsování data
  const parseDate = (dateStr: string | Date): Date => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const canEdit = (artwork: Artwork): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.id === artwork.userId;
  };

  const handleEdit = (artwork: Artwork) => {
    setEditingArtwork(artwork);
    setEditForm({
      title: artwork.title,
      description: artwork.description,
      price: artwork.price,
      status: artwork.status,
      userId: artwork.userId || 0,
      artworkTypeId: artwork.artworkTypeId || 0
    });
  };

  const handleCloseEdit = () => {
    setEditingArtwork(null);
  };

  const handleSaveEdit = async () => {
    if (!editingArtwork || !token) return;

    try {
      // Update artwork basic info (title, description, userId for admin)
      const updateData: any = {
        title: editForm.title,
        description: editForm.description,
        artworkTypeId: editForm.artworkTypeId || null
      };
      
      if (user?.role === 'admin' && editForm.userId) {
        updateData.userId = editForm.userId;
      }
      
      await axios.put(`/api/artworks/${editingArtwork.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Reload artworks
      const arts = await fetchArtworks();
      setArtworks(arts);
      handleCloseEdit();
    } catch (err: any) {
      console.error('Failed to update artwork:', err);
      alert(err?.response?.data?.error || 'Nepodařilo se uložit změny');
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const arts = await fetchArtworks();
        setArtworks(arts);
        
        // Load artwork types
        const typesRes = await axios.get('/api/auth/artwork-types');
        setArtworkTypes(typesRes.data);
        
        // Load users if admin
        if (user?.role === 'admin' && token) {
          const usersRes = await axios.get('/api/auth/users', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUsers(usersRes.data);
        }
      } catch (err: any) {
        setError(err?.message || t('messages.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, token]);

  // Helper to check if user can see "skryto" artworks
  const canSeeHiddenArtworks = (): boolean => {
    return user?.role === 'admin';
  };

  // Filter artworks to exclude "skryto" for non-admin users
  const visibleArtworks = useMemo(() => {
    if (canSeeHiddenArtworks()) {
      return artworks;
    }
    return artworks.filter(art => normalizeStatus(art.status) !== 'skryto');
  }, [artworks, user]);

  // Filtruj jen podle posledního statusu (kterého jsme nastavili z posledního eventu)
  const filteredArtworks = useMemo(() => {
    return visibleArtworks.filter(art => {
      const normalizedStatus = normalizeStatus(art.status);
      const statusMatch = selectedStatus === 'všechny' || normalizedStatus === selectedStatus;
      const typeMatch = selectedArtworkType === 'všechny' || art.artworkTypeId === selectedArtworkType;
      const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         art.description.toLowerCase().includes(searchTerm.toLowerCase());
      return statusMatch && typeMatch && searchMatch;
    });
  }, [visibleArtworks, selectedStatus, selectedArtworkType, searchTerm]);

  if (loading) return <div className="gallery-loading">{t('common.loading')}</div>;
  if (error) return <div className="gallery-error">{t('common.error')}: {error}</div>;

  return (
    <div className="gallery-container">
      {/* Quick Links Section */}
      <div className="gallery-quick-links mb-4">
        <h4 className="mb-3">{t('gallery.browseByStatus') || 'Procházet podle stavu'}</h4>
        <div className="quick-links-grid">
          <button
            className="quick-link-btn"
            onClick={() => navigate('/gallery/k_prodeji')}
          >
            <span className="quick-link-icon">💰</span>
            <span className="quick-link-label">{t('gallery.statusForSale') || 'K prodeji'}</span>
            <span className="quick-link-count">({artworks.filter(a => normalizeStatus(a.status) === 'k prodeji').length})</span>
          </button>
          <button
            className="quick-link-btn"
            onClick={() => navigate('/gallery/vystaveno')}
          >
            <span className="quick-link-icon">🎨</span>
            <span className="quick-link-label">{t('gallery.statusExhibited') || 'Vystaveno'}</span>
            <span className="quick-link-count">({artworks.filter(a => normalizeStatus(a.status) === 'vystaveno').length})</span>
          </button>
        </div>
      </div>

      {/* Browse by Users Section */}
      <div className="gallery-quick-links mb-4">
        <h4 className="mb-3">{t('gallery.browseByUsers') || 'Procházet podle autorů a majitelů'}</h4>
        <div className="quick-links-grid">
          <button
            className="quick-link-btn"
            onClick={() => navigate('/gallery/author/users')}
          >
            <span className="quick-link-icon">✍️</span>
            <span className="quick-link-label">{t('gallery.authors') || 'Autoři'}</span>
          </button>
          <button
            className="quick-link-btn"
            onClick={() => navigate('/gallery/owner/users')}
          >
            <span className="quick-link-icon">👤</span>
            <span className="quick-link-label">{t('gallery.owners') || 'Majitelé'}</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="gallery-controls">
        {/* Row 1: Search */}
        <div className="controls-row controls-row-search">
          <input
            type="text"
            className="gallery-search"
            placeholder={t('gallery.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Row 2: Status Filter */}
        <div className="controls-row controls-row-filters">
          <div className="filter-group">
            <span className="filter-label">{t('gallery.status')}:</span>
            <button
              className={`filter-btn ${selectedStatus === 'všechny' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('všechny')}
            >
              {t('gallery.all')} ({visibleArtworks.length})
            </button>
            {canSeeHiddenArtworks() && (
              <button
                className={`filter-btn ${selectedStatus === 'skryto' ? 'active' : ''}`}
                onClick={() => setSelectedStatus('skryto')}
              >
                {t('gallery.statusHidden')} ({visibleArtworks.filter(a => normalizeStatus(a.status) === 'skryto').length})
              </button>
            )}
            <button
              className={`filter-btn ${selectedStatus === 'vystaveno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('vystaveno')}
            >
              {t('gallery.statusExhibited')} ({visibleArtworks.filter(a => normalizeStatus(a.status) === 'vystaveno').length})
            </button>
            <button
              className={`filter-btn ${selectedStatus === 'k prodeji' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('k prodeji')}
            >
              {t('gallery.statusForSale')} ({visibleArtworks.filter(a => normalizeStatus(a.status) === 'k prodeji').length})
            </button>
            <button
              className={`filter-btn ${selectedStatus === 'rezervováno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('rezervováno')}
            >
              {t('gallery.statusReserved')} ({visibleArtworks.filter(a => normalizeStatus(a.status) === 'rezervováno').length})
            </button>
            <button
              className={`filter-btn ${selectedStatus === 'zrušeno' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('zrušeno')}
            >
              {t('gallery.statusCancelled')} ({visibleArtworks.filter(a => normalizeStatus(a.status) === 'zrušeno').length})
            </button>
          </div>

          <div className="view-toggle-compact">
            <button
              className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Zobrazení jako karty"
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Zobrazení jako seznam"
            >
              ≡
            </button>
          </div>
        </div>

        {/* Row 3: Artwork Type Filter */}
        <div className="controls-row controls-row-type-filter">
          <div className="filter-group">
            <span className="filter-label">{t('gallery.artworkType') || 'Typ díla'}:</span>
            <button
              className={`filter-btn ${selectedArtworkType === 'všechny' ? 'active' : ''}`}
              onClick={() => setSelectedArtworkType('všechny')}
            >
              {t('gallery.all')} ({visibleArtworks.length})
            </button>
            {artworkTypes.map(type => (
              <button
                key={type.id}
                className={`filter-btn ${selectedArtworkType === type.id ? 'active' : ''}`}
                onClick={() => setSelectedArtworkType(type.id)}
              >
                {type.name} ({visibleArtworks.filter(a => a.artworkTypeId === type.id).length})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="gallery-results-info">
        {t('gallery.displayed')}: <strong>{filteredArtworks.length}</strong> {t('gallery.of')} <strong>{visibleArtworks.length}</strong> {t('gallery.works')}
      </div>

      {/* Gallery View */}
      <div className={`artwork-gallery ${viewMode}`}>
        {filteredArtworks.length === 0 ? (
          <div className="gallery-empty">
            {t('gallery.notFound')}
          </div>
        ) : viewMode === 'card' ? (
          <div className="artwork-grid">
            {filteredArtworks.map(art => {
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
                  {art.artworkTypeName && (
                    <div className="mb-2">
                      <span className="badge bg-secondary">{art.artworkTypeName}</span>
                    </div>
                  )}
                  {art.userBio && (
                    <p className="card-bio">
                      <small><em>{art.userBio}</em></small>
                    </p>
                  )}
                  {art.authorBio && (
                    <p className="card-bio" style={{ borderColor: '#d4a574', backgroundColor: '#fef9f0' }}>
                      <small><em>{art.authorBio}</em></small>
                    </p>
                  )}
                  <p className="card-description">{art.description}</p>
                  {art.authorName && (
                    <p className="card-author">
                      <small>
                        {t('gallery.author')}: 
                        <button 
                          className="user-profile-link" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/gallery/owner/${art.authorId}`);
                          }}
                          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          {art.authorName}
                        </button>
                        {isAdmin && art.authorEmail && ` (${art.authorEmail})`}
                      </small>
                    </p>
                  )}
                  {art.userName && (
                    <p className="card-author">
                      <small>
                        {t('gallery.owner')}: 
                        <button 
                          className="user-profile-link" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/gallery/owner/${art.userId}`);
                          }}
                          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          {art.userName}
                        </button>
                        {isAdmin && art.userEmail && ` (${art.userEmail})`}
                      </small>
                    </p>
                  )}                
                  <div className="card-footer">
                    <span className="card-price">{formatPrice(art.price)}</span>
                    <span className="card-date">{parseDate(art.approvedDateTime || new Date().toISOString()).toLocaleDateString('cs-CZ')}</span>
                  </div>
                  {canEdit(art) && (
                    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(art);
                        }}
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
          <div className="artwork-list-view">
            {filteredArtworks.map(art => {
              const normalizedStatus = normalizeStatus(art.status);
              return (
              <div 
                key={art.id} 
                className={`artwork-row artwork-${normalizedStatus.replace(' ', '-')}`}
                onClick={() => navigate(`/artwork/${art.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="row-image">
                  <img src={art.imageUrl} alt={art.title} />
                </div>
                <div className="row-content">
                  <h4 className="row-title">{art.title}</h4>
                  {art.artworkTypeName && (
                    <div className="mb-2">
                      <span className="badge bg-secondary">{art.artworkTypeName}</span>
                    </div>
                  )}
                  {art.userBio && (
                    <p className="row-bio">
                      <small><em>{art.userBio}</em></small>
                    </p>
                  )}
                  {art.authorBio && (
                    <p className="row-bio" style={{ borderColor: '#d4a574', backgroundColor: '#fef9f0' }}>
                      <small><em>{art.authorBio}</em></small>
                    </p>
                  )}
                  <p className="row-description">{art.description}</p>
                  {art.userName && (
                    <p className="row-author">
                      <small>
                        {t('gallery.owner')}: 
                        <button 
                          className="user-profile-link" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/gallery/owner/${art.userId}`);
                          }}
                          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          {art.userName}
                        </button>
                        {isAdmin && art.userEmail && ` (${art.userEmail})`}
                      </small>
                    </p>
                  )}
                  {art.authorName && (
                    <p className="row-author">
                      <small>
                        {t('gallery.author')}: 
                        <button 
                          className="user-profile-link" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/gallery/owner/${art.authorId}`);
                          }}
                          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          {art.authorName}
                        </button>
                        {isAdmin && art.authorEmail && ` (${art.authorEmail})`}
                      </small>
                    </p>
                  )}
                </div>
                <div className="row-meta">
                  <div className={`row-status status-${normalizedStatus.replace(' ', '-')}`}>
                    {getStatusLabel(normalizedStatus)}
                  </div>
                  <div className="row-price">{formatPrice(art.price)}</div>
                  <div className="row-date">{parseDate(art.approvedDateTime || new Date().toISOString()).toLocaleDateString('cs-CZ')}</div>
                </div>
                {canEdit(art) && (
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(art);
                      }}
                    >
                      ✏️ {t('gallery.edit')}
                    </Button>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal show={!!editingArtwork} onHide={handleCloseEdit} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('gallery.editArtworkModal')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {user?.role === 'admin' ? (
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k as any)} className="mb-3">
              <Tab eventKey="details" title={t('tabs.basicInfo')}>
                <Form className="mt-3">
                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.fieldTitle')}</Form.Label>
                    <Form.Control
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.fieldDescription')}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('gallery.artworkType')}</Form.Label>
                    <Form.Select
                      value={editForm.artworkTypeId.toString()}
                      onChange={e => setEditForm({ ...editForm, artworkTypeId: parseInt(e.target.value) || 0 })}
                    >
                      <option value="0">-- {t('gallery.selectType')} --</option>
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
                        value={editForm.userId}
                        onChange={e => setEditForm({ ...editForm, userId: parseInt(e.target.value) })}
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
                </Form>
              </Tab>

              {editingArtwork && (
                <Tab eventKey="images" title={t('tabs.images')}>
                  <div className="mt-3">
                    <ArtworkImageManager 
                      artworkId={Number(editingArtwork.id)} 
                      onImagesUpdated={async () => {
                        const arts = await fetchArtworks();
                        setArtworks(arts);
                      }}
                    />
                  </div>
                </Tab>
              )}

              <Tab eventKey="events" title={t('tabs.events')}>
                {editingArtwork && (
                  <ArtworkEventsManager 
                    artworkId={Number(editingArtwork.id)}
                    onEventsUpdated={async () => {
                      const arts = await fetchArtworks();
                      setArtworks(arts);
                    }}
                  />
                )}
              </Tab>
            </Tabs>
          ) : (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>{t('gallery.fieldTitle')}</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('gallery.fieldDescription')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEdit}>
            {t('buttons.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            {t('buttons.save')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ArtworkList;
