import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
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
  authorName?: string;
  authorEmail?: string;
  authorBio?: string;
  authorId?: number;
  artworkTypeId?: number;
  artworkTypeName?: string;
  artworkTypeNameEn?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface ArtworksByUserProps {
  userType: 'author' | 'owner';
  userId: number;
}

const ArtworksByUser: React.FC<ArtworksByUserProps> = ({ userType, userId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [allArtworkTypes, setAllArtworkTypes] = useState<Array<{ id: number; name: string; name_en: string }>>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [userName, setUserName] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<'author' | 'owner'>(userType); // Track current active role
  const [ownerCount, setOwnerCount] = useState(0); // Count of artworks where user is owner
  const [authorCount, setAuthorCount] = useState(0); // Count of artworks where user is author
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'events'>('details');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    artworkTypeId: 0
  });

  // Funkce pro překlad statusu
  const getStatusLabel = (status: string): string => {
    const normalizedStatus = status.replace('_', ' ');
    const statusMap: Record<string, string> = {
      'skryto': t('gallery.statusHidden'),
      'vystaveno': t('gallery.statusExhibited'),
      'k prodeji': t('gallery.statusForSale'),

      'zrušeno': t('gallery.statusCancelled'),
    };
    return statusMap[normalizedStatus] || status;
  };

  // Helper pro normalizaci statusu z backendu
  const normalizeStatus = (status: string): string => {
    return status.replaceAll('_', ' ');
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

      // Reload artworks pro daného uživatele
      const role = userType === 'author' ? 'author' : 'owner';
      const res = await axios.get(`/api/artworks/by-user/${userId}?role=${role}`);
      const arts = res.data.map((a: any) => ({
        ...a,
        imageUrl: a.imageUrl || a.image_url,
        approvedDateTime: a.approvedDateTime || a.approved_at,
        userEmail: a.userEmail || a.user_email,
        userName: a.userName || a.user_name,
        artworkTypeId: a.artworkTypeId || a.artwork_type_id,
        artworkTypeName: a.artworkTypeName || a.artwork_type_name,
        artworkTypeNameEn: a.artworkTypeNameEn || a.artwork_type_name_en,
      }));
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
        // Load artworks for current role
        const role = currentRole === 'author' ? 'author' : 'owner';
        const res = await axios.get(`/api/artworks/by-user/${userId}?role=${role}`);
        
        const arts = res.data.map((a: any) => ({
          ...a,
          imageUrl: a.imageUrl || a.image_url,
          approvedDateTime: a.approvedDateTime || a.approved_at,
          userEmail: a.userEmail || a.user_email,
          userName: a.userName || a.user_name,
          userBio: a.userBio || a.user_bio,
          artworkTypeId: a.artworkTypeId || a.artwork_type_id,
          artworkTypeName: a.artworkTypeName || a.artwork_type_name,
          artworkTypeNameEn: a.artworkTypeNameEn || a.artwork_type_name_en,
        }));
        setArtworks(arts);
        
        // Set user name from first artwork
        if (arts.length > 0) {
          setUserName(arts[0].userName || '');
        }
        
        // Update count for current role
        if (currentRole === 'owner') {
          setOwnerCount(arts.length);
        } else {
          setAuthorCount(arts.length);
        }
        
        // Load all artwork types (for edit modal)
        const allTypesRes = await axios.get('/api/auth/artwork-types');
        setAllArtworkTypes(allTypesRes.data);
      } catch (err: any) {
        setError(err?.message || t('messages.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, currentRole, t]);

  // Check if current user can see "skryto" artworks of this user
  const canSeeHiddenArtworks = (): boolean => {
    // Admin can see all
    if (user?.role === 'admin') return true;
    // User can see their own hidden artworks
    return user?.id === userId;
  };

  // Filter artworks to exclude "skryto" for users viewing other users' galleries
  const visibleArtworks = useMemo(() => {
    if (canSeeHiddenArtworks()) {
      return artworks;
    }
    return artworks.filter(art => normalizeStatus(art.status) !== 'skryto');
  }, [artworks, user, userId]);

  // Filter artworks by search term only
  const filteredArtworks = useMemo(() => {
    return visibleArtworks.filter(art => {
      const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         art.description.toLowerCase().includes(searchTerm.toLowerCase());
      return searchMatch;
    });
  }, [visibleArtworks, searchTerm]);

  if (loading) return <div className="gallery-loading">{t('common.loading')}</div>;
  if (error) return <div className="gallery-error">{t('common.error')}: {error}</div>;

  console.log('[ArtworksByUser] Rendering:', { currentRole, ownerCount, authorCount, artworksLength: artworks.length, filteredLength: filteredArtworks.length });

  return (
    <div className="filtered-gallery-container">
      {/* Header */}
      <div className="filtered-gallery-header">
        <h1>{userName}</h1>
        
        {/* Role Switcher */}
        <div className="role-switcher" style={{ marginBottom: '1.5rem' }}>
          {ownerCount > 0 && (
            <button
              className={`role-switch-btn ${currentRole === 'owner' ? 'active' : ''}`}
              onClick={() => {
                setCurrentRole('owner');
                setSelectedStatus('all');
              }}
              style={{
                padding: '0.5rem 1rem',
                marginRight: '1rem',
                backgroundColor: currentRole === 'owner' ? '#a8d5ba' : '#f0f0f0',
                border: '1px solid #d0d0d0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: currentRole === 'owner' ? 'bold' : 'normal',
                color: currentRole === 'owner' ? '#2c3e50' : '#7f8c8d'
              }}
            >
              👤 {t('gallery.owner') || 'Majitel'} ({ownerCount})
            </button>
          )}
          {authorCount > 0 && (
            <button
              className={`role-switch-btn ${currentRole === 'author' ? 'active' : ''}`}
              onClick={() => {
                setCurrentRole('author');
                setSelectedStatus('all');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: currentRole === 'author' ? '#a8d5ba' : '#f0f0f0',
                border: '1px solid #d0d0d0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: currentRole === 'author' ? 'bold' : 'normal',
                color: currentRole === 'author' ? '#2c3e50' : '#7f8c8d'
              }}
            >
              ✍️ {t('gallery.author') || 'Autor'} ({authorCount})
            </button>
          )}
        </div>
        
        <p className="text-muted">
          {t('gallery.displayed')}: <strong>{filteredArtworks.length}</strong> {t('gallery.of')} <strong>{visibleArtworks.length}</strong> {t('gallery.works')}
        </p>
      </div>

      {/* Search Bar */}
      <div className="search-bar-container" style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          className="gallery-search"
          placeholder={t('gallery.search') || 'Hledat...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.75rem',
            border: '1px solid #d0d0d0',
            borderRadius: '6px',
            fontSize: '1rem'
          }}
        />
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
                    {currentRole === 'author' && art.authorBio && (
                      <p className="card-bio">
                        <small><em>{art.authorBio}</em></small>
                      </p>
                    )}
                    {currentRole === 'owner' && art.userBio && (
                      <p className="card-bio">
                        <small><em>{art.userBio}</em></small>
                      </p>
                    )}
                    <p className="card-description">{art.description}</p>
                    {currentRole === 'author' && art.authorEmail && (
                      <p className="card-author">
                        <small>
                          {t('gallery.author')}: 
                          <button 
                            className="user-profile-link" 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Do not navigate when showing author
                            }}
                            style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'default', textDecoration: 'none', padding: 0 }}
                          >
                            {art.authorName}
                          </button>
                          ({art.authorEmail})
                        </small>
                      </p>
                    )}
                    {currentRole === 'author' && art.userEmail && (
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
                    {currentRole === 'owner' && art.userEmail && (
                      <p className="card-author">
                        <small>
                          {t('gallery.author')}: 
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
                    {currentRole === 'author' && art.authorEmail && (
                      <p className="row-author">
                        <small>
                          {t('gallery.author')}: 
                          <button 
                            className="user-profile-link" 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Do not navigate when showing author
                            }}
                            style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'default', textDecoration: 'none', padding: 0 }}
                          >
                            {art.authorName}
                          </button>
                          ({art.authorEmail})
                        </small>
                      </p>
                    )}
                    {currentRole === 'author' && art.userEmail && (
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
                    {currentRole === 'owner' && art.userEmail && (
                      <p className="row-author">
                        <small>
                          {t('gallery.author')}: 
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

export default ArtworksByUser;
