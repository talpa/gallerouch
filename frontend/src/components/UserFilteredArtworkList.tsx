import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { fetchArtworks } from '../api/artworks';
import { formatPrice } from '../utils/currency';
import { Modal, Button, Form, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import ArtworkImageManager from './ArtworkImageManager';
import ArtworkEventsManager from './ArtworkEventsManager';
import './FilteredArtworkList.css';

export type ViewMode = 'card' | 'list';

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
  userBio?: string;
  authorId?: number;
  artworkTypeId?: number;
  artworkTypeName?: string;
  artworkTypeNameEn?: string;
}

interface StatusCount {
  status: string;
  count: number;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio?: string;
  bio_approved?: boolean;
  created_at: string;
  artworkTypes: Array<{
    id: number;
    name: string;
    name_en: string;
    approved: boolean;
    approved_at: string;
  }>;
}

interface UserFilteredArtworkListProps {
  userId: number;
  filterType: 'owner' | 'author';
}

const UserFilteredArtworkList: React.FC<UserFilteredArtworkListProps> = ({ userId, filterType }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [allArtworkTypes, setAllArtworkTypes] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
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
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Helper pro normalizaci statusu z backendu
  const normalizeStatus = (status: string): string => {
    const s = status.replaceAll('_', ' ').toLowerCase();
    if (s === 'prodáno') return 'vystaveno';
    return s;
  };

  // Funkce pro překlad statusu
  const getStatusLabel = (status: string): string => {
    const normalizedStatus = normalizeStatus(status);
    const statusMap: Record<string, string> = {
      'skryto': t('gallery.statusHidden'),
      'vystaveno': t('gallery.statusExhibited'),
      'k prodeji': t('gallery.statusForSale'),
      'rezervováno': t('gallery.statusReserved'),
      'zrušeno': t('gallery.statusCancelled'),
    };
    return statusMap[normalizedStatus] || status;
  };

  // Helper pro bezpečné parsování data
  const parseDate = (dateStr: string | Date): Date => {
    if (!dateStr) return new Date();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  // Check if user can edit artwork
  const canEdit = (artwork: Artwork): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.id === artwork.userId;
  };

  // Handle edit artwork
  const handleEdit = (artwork: Artwork, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingArtwork(artwork);
    setEditForm({
      title: artwork.title,
      description: artwork.description,
      artworkTypeId: artwork.artworkTypeId || 0
    });
  };

  // Close edit modal
  const handleCloseEdit = () => {
    setEditingArtwork(null);
  };

  // Save edit changes
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
        // Načti profil uživatele
        const profileRes = await axios.get(`/api/auth/profile/${userId}`);
        setUserProfile(profileRes.data);
        setUserName(profileRes.data.username);
        
        // Načti všechna artworks
        const arts = await fetchArtworks();
        // Ensure authorId is present for author filtering
        const mappedArts = arts.map((a: any) => ({
          ...a,
          authorId: a.authorId ?? a.author_id,
        }));
        setArtworks(mappedArts);
        
        // Načti statusy pro daného uživatele
        const statusRes = await axios.get(`/api/artworks/statuses-by-user/${userId}?role=${filterType}`);
        
        console.log('[UserFilteredArtworkList] Raw status counts from backend:', statusRes.data);
        
        // Normalize and merge duplicate statuses (e.g., prodáno → vystaveno)
        const statusMap = new Map<string, number>();
        statusRes.data.forEach((sc: StatusCount) => {
          const normalized = normalizeStatus(sc.status);
          // Parse count as number to prevent string concatenation
          const countNum = typeof sc.count === 'string' ? parseInt(sc.count, 10) : sc.count;
          console.log(`[UserFilteredArtworkList] Status: ${sc.status} → normalized: ${normalized}, count: ${countNum}`);
          
          // Skip skryto and zrušeno for non-admin users
          if (!user || user.role !== 'admin') {
            if (normalized === 'skryto' || normalized === 'zrušeno') {
              return;
            }
          }
          statusMap.set(normalized, (statusMap.get(normalized) || 0) + countNum);
        });
        
        const mergedCounts: StatusCount[] = Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          count
        }));
        
        console.log('[UserFilteredArtworkList] Merged status counts:', mergedCounts);
        setStatusCounts(mergedCounts);
        
        // Načti všechny artwork types (pro edit modal)
        const allTypesRes = await axios.get('/api/auth/artwork-types');
        setAllArtworkTypes(allTypesRes.data);
      } catch (err: any) {
        setError(err?.message || t('messages.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, t]);

  // Check if current user can see "skryto" artworks of the selected user
  const canSeeHiddenArtworks = (): boolean => {
    // Admin can see all
    if (user?.role === 'admin') return true;
    // User can see their own hidden artworks
    return user?.id === userId;
  };

  // Filter artworks to exclude "skryto" for non-owner/non-admin users
  const visibleArtworks = useMemo(() => {
    if (canSeeHiddenArtworks()) {
      return artworks;
    }
    return artworks.filter(art => normalizeStatus(art.status) !== 'skryto');
  }, [artworks, user, userId]);

  // Filtruj artworks podle uživatele a statusu
  const filteredArtworks = useMemo(() => {
    return visibleArtworks.filter(art => {
      // Filtruj podle uživatele (majitel nebo autor)
      const userMatch = filterType === 'owner'
        ? art.userId === userId
        : art.authorId === userId;
      
      // Filtruj podle statusu
      const normalizedStatus = normalizeStatus(art.status);
      const statusMatch = selectedStatus === 'all' || normalizeStatus(art.status) === normalizeStatus(selectedStatus);
      
      // Filtruj podle vyhledávání
      const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         art.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      return userMatch && statusMatch && searchMatch;
    });
  }, [visibleArtworks, userId, selectedStatus, searchTerm, filterType]);

  if (loading) return <div className="gallery-loading">{t('common.loading')}</div>;
  if (error) return <div className="gallery-error">{t('common.error')}: {error}</div>;

  return (
    <div className="filtered-gallery-container">
      {/* User Profile Section */}
      {userProfile && (
        <div className="user-profile-section" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
            {/* Avatar */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'white',
              color: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              fontWeight: 'bold',
              flexShrink: 0
            }}>
              {userProfile.username.charAt(0).toUpperCase()}
            </div>
            
            {/* Profile Info */}
            <div style={{ flex: 1 }}>
              <h2 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>{userProfile.username}</h2>
              <p style={{ marginBottom: '1rem', opacity: 0.9 }}>{userProfile.email}</p>
              
              {/* Bio */}
              {userProfile.bio_approved && userProfile.bio && (
                <div style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  padding: '1rem', 
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ margin: 0, lineHeight: '1.6' }}>{userProfile.bio}</p>
                </div>
              )}
              
              {/* Artwork Types */}
              {userProfile.artworkTypes && userProfile.artworkTypes.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
                    {t('gallery.artworkTypes') || 'Typy uměleckých děl'}:
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {userProfile.artworkTypes.map(type => (
                      <span 
                        key={type.id}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          padding: '0.4rem 1rem',
                          borderRadius: '1.5rem',
                          fontSize: '0.9rem',
                          fontWeight: '500'
                        }}
                      >
                        {type.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="filtered-gallery-header">
        <h1>
          {filterType === 'author' ? t('gallery.author') : t('gallery.owner')}: {userName}
        </h1>
        <p className="text-muted">
          {t('gallery.displayed')}: <strong>{filteredArtworks.length}</strong> {t('gallery.of')} <strong>{visibleArtworks.filter(a => (filterType === 'owner' ? a.userId === userId : a.authorId === userId)).length}</strong> {t('gallery.works')}
        </p>
      </div>

      {/* Status Filter */}
      {statusCounts.length > 0 && (
        <div className="artwork-types-filter">
          <h5>{t('gallery.status')}</h5>
          <div className="type-chips">
            <button
              className={`type-chip ${selectedStatus === 'all' ? 'selected' : ''}`}
              onClick={() => setSelectedStatus('all')}
            >
              {t('gallery.all')} <span className="type-count">({statusCounts.reduce((sum, sc) => sum + (typeof sc.count === 'string' ? parseInt(sc.count, 10) : sc.count), 0)})</span>
            </button>
            {statusCounts.map(sc => (
              <button
                key={sc.status}
                className={`type-chip ${selectedStatus === sc.status ? 'selected' : ''}`}
                onClick={() => setSelectedStatus(sc.status)}
              >
                {getStatusLabel(sc.status)} <span className="type-count">({sc.count})</span>
              </button>
            ))}
          </div>
          {selectedStatus !== 'all' && (
            <button
              className="clear-filters-btn"
              onClick={() => setSelectedStatus('all')}
            >
              ✕ {t('gallery.clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Controls Bar */}
      <div className="gallery-controls">
        <div className="controls-left">
          <input
            type="text"
            className="gallery-search"
            placeholder={t('gallery.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="controls-right">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title={t('gallery.cardView')}
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('gallery.listView')}
            >
              ≡
            </button>
          </div>
        </div>
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
                    <p className="card-description">{art.description}</p>
                    {art.userEmail && filterType === 'author' && (
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
                          ({art.userEmail})
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
                      <span className="badge bg-secondary me-2">{art.artworkTypeName}</span>
                    )}
                    <p className="row-description">{art.description}</p>
                    {art.userEmail && filterType === 'author' && (
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
                          ({art.userEmail})
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
      </div>

      {/* Edit Modal */}
      {editingArtwork && (
        <Modal show={true} onHide={handleCloseEdit} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{t('gallery.editArtworkModal')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => setActiveTab(k as 'details' | 'images' | 'events')}
              className="mb-3"
            >
              <Tab eventKey="details" title={t('common.details') || 'Detaily'}>
                <Form>
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
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  <div className="alert alert-info">
                    {user?.role === 'admin' 
                      ? t('gallery.changesAutoApproved')
                      : t('gallery.changesRequireApproval')}
                  </div>
                </Form>
              </Tab>

              <Tab eventKey="images" title={t('common.images') || 'Obrázky'}>
                {editingArtwork && (
                  <ArtworkImageManager artworkId={Number(editingArtwork.id)} />
                )}
              </Tab>

              <Tab eventKey="events" title={t('events.events') || 'Události'}>
                {editingArtwork && (
                  <ArtworkEventsManager artworkId={Number(editingArtwork.id)} />
                )}
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEdit}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              {t('common.save')}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default UserFilteredArtworkList;
