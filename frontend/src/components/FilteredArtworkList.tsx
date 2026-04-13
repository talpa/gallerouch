import React, { useEffect, useState, useMemo } from 'react';
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
import './FilteredArtworkList.css';

export type ArtworkStatus = 'skryto' | 'vystaveno' | 'k_prodeji' | 'rezervováno' | 'zrušeno';
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
  artworkTypeId?: number;
  artworkTypeName?: string;
  artworkTypeNameEn?: string;
}

interface ArtworkType {
  id: number;
  name: string;
  name_en: string;
  count: number;
}

interface FilteredArtworkListProps {
  initialStatus: string;
}

const FilteredArtworkList: React.FC<FilteredArtworkListProps> = ({ initialStatus }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [artworkTypes, setArtworkTypes] = useState<ArtworkType[]>([]);
  const [allArtworkTypes, setAllArtworkTypes] = useState<ArtworkType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);
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

  // Převod statusu z URL formátu na backend formát
  const backendStatus = initialStatus.replace('_', ' ');

  // Funkce pro překlad statusu
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

  // Toggle výběr typu
  const toggleTypeSelection = (typeId: number) => {
    setSelectedTypeIds(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
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
        // Načti všechna artworks
        const arts = await fetchArtworks();
        setArtworks(arts);
        
        // Načti artwork types s počty pro daný status (pro filtraci)
        const typesRes = await axios.get(`/api/artworks/types-by-status?status=${backendStatus}`);
        setArtworkTypes(normalizeArrayPayload(typesRes.data));
        
        // Načti všechny artwork types (pro edit modal)
        const allTypesRes = await axios.get('/api/auth/artwork-types');
        setAllArtworkTypes(normalizeArrayPayload(allTypesRes.data));
      } catch (err: any) {
        setError(err?.message || t('messages.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialStatus, backendStatus, t]);

  // Check if current user can see "skryto" artworks
  const canSeeHiddenArtworks = (): boolean => {
    return user?.role === 'admin';
  };

  // If user is not admin and trying to view "skryto", redirect or show empty
  if (backendStatus === 'skryto' && !canSeeHiddenArtworks()) {
    return (
      <div className="filtered-gallery-container">
        <div className="gallery-empty">
          <p className="text-center text-muted mt-5">
            {t('gallery.notFound')}
          </p>
        </div>
      </div>
    );
  }

  // Filtruj artworks podle statusu, vybraných typů a vyhledávání
  const filteredArtworks = useMemo(() => {
    return artworks.filter(art => {
      const normalizedStatus = normalizeStatus(art.status);
      const statusMatch = normalizedStatus === backendStatus;
      
      const typeMatch = selectedTypeIds.length === 0 || 
                       (art.artworkTypeId && selectedTypeIds.includes(art.artworkTypeId));
      
      const searchMatch = art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         art.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      return statusMatch && typeMatch && searchMatch;
    });
  }, [artworks, backendStatus, selectedTypeIds, searchTerm]);

  if (loading) return <div className="gallery-loading">{t('common.loading')}</div>;
  if (error) return <div className="gallery-error">{t('common.error')}: {error}</div>;

  return (
    <div className="filtered-gallery-container">
      {/* Header */}
      <div className="filtered-gallery-header">
        <h1>{getStatusLabel(backendStatus)}</h1>
        <p className="text-muted">
          {t('gallery.displayed')}: <strong>{filteredArtworks.length}</strong> {t('gallery.of')} <strong>{artworks.filter(a => normalizeStatus(a.status) === backendStatus).length}</strong> {t('gallery.works')}
        </p>
      </div>

      {/* Artwork Types Filter */}
      {artworkTypes.length > 0 && (
        <div className="artwork-types-filter">
          <h5>{t('gallery.filterByType')}</h5>
          <div className="type-chips">
            {artworkTypes.map(type => (
              <button
                key={type.id}
                className={`type-chip ${selectedTypeIds.includes(type.id) ? 'selected' : ''}`}
                onClick={() => toggleTypeSelection(type.id)}
              >
                {getTypeLabel(type)} <span className="type-count">({type.count})</span>
              </button>
            ))}
          </div>
          {selectedTypeIds.length > 0 && (
            <button
              className="clear-filters-btn"
              onClick={() => setSelectedTypeIds([])}
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
                    {getArtworkTypeLabel(art) && (
                      <div className="mb-2">
                        <span className="badge bg-secondary">{getArtworkTypeLabel(art)}</span>
                      </div>
                    )}
                    {art.userBio && (
                      <p className="card-bio">
                        <small><em>{art.userBio}</em></small>
                      </p>
                    )}
                    <p className="card-description">{art.description}</p>
                    {art.userEmail && (
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
                    {getArtworkTypeLabel(art) && (
                      <span className="badge bg-secondary me-2">{getArtworkTypeLabel(art)}</span>
                    )}
                    {art.userBio && (
                      <p className="row-bio">
                        <small><em>{art.userBio}</em></small>
                      </p>
                    )}
                    <p className="row-description">{art.description}</p>
                    {art.userEmail && (
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
                          {getTypeLabel(type)}
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

export default FilteredArtworkList;
