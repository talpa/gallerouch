import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Container, Card, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { formatPrice } from '../utils/currency';
import PaymentQRCode from '../components/PaymentQRCode';
import { OfferModal } from '../components/OfferModal';
import ArtworkHistoryTable from '../components/ArtworkHistoryTable';
import PublicLayout from '../components/PublicLayout';
import './ArtworkDetailPage.css';

interface ArtworkEvent {
  id: number;
  artworkId: number;
  type: string;
  status: string;
  details: string;
  createdBy: number;
  createdByName?: string;
  createdByEmail?: string;
  price: number;
  approvedAt: string;
  approvedBy: number;
  ownerId?: number;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: string;
}

interface Payment {
  id: number;
  artworkId: number;
  buyerId: number;
  price: number;
  status: string;
  bankAccountNumber: string;
  galleryName: string;
  paymentDescriptionTemplate: string;
  artworkTitle: string;
  createdAt: string;
  confirmedAt?: string;
}

interface Artwork {
  id: number;
  title: string;
  description: string;
  userId: number;
  authorId?: number;
  imageUrl: string;
  status: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
  authorName?: string;
  authorEmail?: string;
}

const ArtworkDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [events, setEvents] = useState<ArtworkEvent[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offersCount, setOffersCount] = useState(0);

  useEffect(() => {
    loadArtworkDetails();
  }, [id]);

  useEffect(() => {
    if (artwork && user && token) {
      loadPaymentForArtwork();
    }
  }, [artwork, user, token]);

  const loadArtworkDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load artwork details
      const artworkRes = await axios.get(`/api/artworks`);
      const artworkData = artworkRes.data.find((a: Artwork) => a.id === parseInt(id || '0'));
      
      if (!artworkData) {
        setError(t('artworkDetail.notFound') || 'Artwork not found');
        setLoading(false);
        return;
      }

      // Check if user can access hidden artworks
      const normalizedStatus = artworkData.status?.replace('_', ' ');
      if (normalizedStatus === 'skryto' && user?.role !== 'admin' && user?.id !== artworkData.userId) {
        setError(t('artworkDetail.notFound') || 'Artwork not found');
        setLoading(false);
        return;
      }
      
      setArtwork(artworkData);
      
      // Load approved events for history
      const eventsRes = await axios.get(
        `/api/artworks/${id}/events`
      );
      
      // Filter only approved events
      const approvedEvents = eventsRes.data.filter(
        (e: ArtworkEvent) => e.approvedAt && e.status === 'approved'
      );
      
      // Sort by creation date descending (newest first)
      approvedEvents.sort((a: ArtworkEvent, b: ArtworkEvent) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setEvents(approvedEvents);
    } catch (err: any) {
      console.error('Error loading artwork details:', err);
      setError(err.response?.data?.error || t('artworkDetail.loadError') || 'Failed to load artwork');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyClick = async () => {
    // Check if user is logged in
    if (!token || !user) {
      setError(t('artworkDetail.loginRequired') || 'Pro nákup se musíte přihlásit');
      // Přesměrovat na login s instrukcí vrátit se zpět na toto artwork
      setTimeout(() => {
        navigate('/login', { 
          state: { from: location.pathname } 
        });
      }, 1500);
      return;
    }

    // Check if artwork is for sale
    if (artwork?.status !== 'k_prodeji') {
      setError(t('artworkDetail.notForSale') || 'Toto dílo není k prodeji');
      return;
    }

    // Get latest price from events
    const latestPriceEvent = events.find(e => e.price > 0);
    if (!latestPriceEvent) {
      setError(t('artworkDetail.noPriceSet') || 'Cena není stanovena');
      return;
    }

    if (!window.confirm(
      t('artworkDetail.confirmPurchase', { 
        title: artwork.title, 
        price: formatPrice(latestPriceEvent.price) 
      }) || `Opravdu chcete koupit "${artwork.title}" za ${formatPrice(latestPriceEvent.price)}?`
    )) {
      return;
    }

    setPurchasing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post(
        '/api/payments',
        {
          artworkId: artwork.id,
          price: latestPriceEvent.price
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Load the created payment to get QR code data
      const paymentData = response.data;
      setPayment(paymentData);

      setSuccess(
        t('artworkDetail.purchaseSuccess') || 
        'Nákup byl úspěšný! Platba čeká na potvrzení administrátorem.'
      );
      
      // Reload artwork to show updated status
      setTimeout(() => {
        loadArtworkDetails();
      }, 2000);
    } catch (err: any) {
      console.error('Purchase error:', err);
      const errorCode = err.response?.data?.error;
      let errorMessage = err.response?.data?.message || t('artworkDetail.purchaseError') || 'Nepodařilo se dokončit nákup';
      
      // Check if error code needs translation
      if (errorCode === 'cannotBuyOwnArtwork') {
        errorMessage = t('payments.cannotBuyOwnArtwork') || 'Nemůžete koupit své vlastní dílo';
      }
      
      setError(errorMessage);
    } finally {
      setPurchasing(false);
    }
  };

  const loadPaymentForArtwork = async () => {
    if (!artwork || !user) return;
    
    try {
      const response = await axios.get(
        `/api/payments`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Find payment for this artwork that belongs to current user as buyer
      const artworkPayment = response.data.find(
        (p: Payment) => p.artworkId === artwork.id && p.buyerId === user.id && p.status === 'unpaid'
      );
      
      if (artworkPayment) {
        setPayment(artworkPayment);
      }
    } catch (err) {
      console.error('Error loading payment:', err);
    }
  };

  const getEventTypeLabel = (type: string): string => {
    const types: { [key: string]: string } = {
      created: '🎨 ' + (t('events.typeCreated') || 'Vytvořeno'),
      updated: '✏️ ' + (t('events.typeUpdated') || 'Aktualizováno'),
      price_change: '💰 ' + (t('events.typePriceChange') || 'Změna ceny'),
      status_change: '🔄 ' + (t('events.typeStatusChange') || 'Změna stavu'),
      deleted: '🗑️ ' + (t('events.typeDeleted') || 'Smazáno'),
      ownership_change: '👤 ' + (t('events.typeOwnerChange') || 'Změna vlastníka'),
    };
    return types[type] || type;
  };

  const getStatusBadgeVariant = (status: string): string => {
    // Sold state no longer used; map to exhibited
    if (status === 'prodáno') return 'success';
    if (status === 'rezervováno') return 'warning';
    if (status === 'k_prodeji') return 'primary';
    if (status === 'vystaveno') return 'info';
    if (status === 'skryto') return 'secondary';
    return 'secondary';
  };

  // Simple function that will be called on each render with current translations
  const getStatusLabel = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'skryto': t('gallery.statusHidden'),
      'vystaveno': t('gallery.statusExhibited'),
      'k_prodeji': t('gallery.statusForSale'),
      'rezervováno': t('gallery.statusReserved'),
      'prodáno': t('gallery.statusExhibited'),
      'zrušeno': t('gallery.statusCancelled'),
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <PublicLayout>
        <Container className="artwork-detail-page mt-4">
          <div className="text-center">
            <Spinner animation="border" />
            <p>{t('common.loading') || 'Načítání...'}</p>
          </div>
        </Container>
      </PublicLayout>
    );
  }

  if (error && !artwork) {
    return (
      <PublicLayout>
        <Container className="artwork-detail-page mt-4">
          <Alert variant="danger">{error}</Alert>
          <Button variant="secondary" onClick={() => navigate('/')}>
            {t('buttons.backToGallery') || 'Zpět do galerie'}
          </Button>
        </Container>
      </PublicLayout>
    );
  }

  if (!artwork) {
    return null;
  }

  const latestPriceEvent = events.find(e => e.price > 0);
  const currentPrice = latestPriceEvent?.price || 0;
  const isForSale = artwork.status === 'k_prodeji';
  const isSold = false;
  const hasUnpaidReservation = !!(payment && payment.status === 'unpaid');

  return (
    <PublicLayout>
      <Container className="artwork-detail-page mt-4 mb-5">
        <Button 
          variant="link" 
          onClick={() => navigate('/')}
          className="mb-3 p-0"
        >
          ← {t('buttons.backToGallery') || 'Zpět do galerie'}
        </Button>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card className="artwork-detail-card mb-4">
        <Card.Body>
          <div className="row">
            <div className="col-md-6">
              {artwork.imageUrl ? (
                <img 
                  src={artwork.imageUrl} 
                  alt={artwork.title}
                  className="artwork-detail-image"
                />
              ) : (
                <div className="artwork-no-image">
                  {t('artworkDetail.noImage') || 'Bez obrázku'}
                </div>
              )}
            </div>
            <div className="col-md-6">
              <h2>{artwork.title}</h2>
              
              <div className="mb-3">
                <Badge bg={getStatusBadgeVariant(artwork.status)} className="me-2">
                  {getStatusLabel(artwork.status)}
                </Badge>
                {isSold && (
                  <Badge bg="danger">
                    {t('gallery.statusExhibited') || 'Vystaveno'}
                  </Badge>
                )}
              </div>

              {artwork.description && (
                <div className="mb-3">
                  <strong>{t('artworkDetail.description') || 'Popis'}:</strong>
                  <p>{artwork.description}</p>
                </div>
              )}

              {artwork.authorName && (
                <div className="mb-3">
                  <strong>{t('gallery.author') || 'Autor'}:</strong>{' '}
                  <button 
                    className="user-profile-link" 
                    onClick={() => navigate(`/gallery/author/${artwork.authorId}`)}
                    style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    {artwork.authorName}
                  </button>
                  {artwork.authorEmail && ` (${artwork.authorEmail})`}
                </div>
              )}

              {artwork.userName && (
                <div className="mb-3">
                  <strong>{t('gallery.owner') || 'Majitel'}:</strong>{' '}
                  <button 
                    className="user-profile-link" 
                    onClick={() => navigate(`/gallery/owner/${artwork.userId}`)}
                    style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    {artwork.userName}
                  </button>
                  {artwork.userEmail && ` (${artwork.userEmail})`}
                </div>
              )}

              {currentPrice > 0 && (
                <div className="mb-3">
                  <h4 className="text-primary">
                    {t('artworkDetail.price') || 'Cena'}: {formatPrice(currentPrice)}
                  </h4>
                </div>
              )}

              {isForSale && currentPrice > 0 && (
                <Button
                  variant="success"
                  size="lg"
                  onClick={handleBuyClick}
                  disabled={purchasing}
                  className="w-100"
                >
                  {purchasing ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      {t('artworkDetail.processing') || 'Zpracovávání...'}
                    </>
                  ) : (
                    <>
                      🛒 {t('buttons.buy') || 'Koupit'}
                    </>
                  )}
                </Button>
              )}

              {/* Offer button for vystaveno artworks */}
              {artwork.status === 'vystaveno' && user && user.id !== artwork.userId && (
                <Button
                  variant="outline-primary"
                  size="lg"
                  onClick={() => setShowOfferModal(true)}
                  className="w-100 mt-2"
                >
                  💰 {t('offers.makeOffer') || 'Nabídnout cenu'}
                </Button>
              )}

              {/* Login prompt for offer */}
              {artwork.status === 'vystaveno' && !user && (
                <Button
                  variant="outline-primary"
                  size="lg"
                  onClick={() => {
                    navigate('/login', { state: { from: location.pathname } });
                  }}
                  className="w-100 mt-2"
                >
                  💰 {t('offers.makeOffer') || 'Nabídnout cenu'}
                </Button>
              )}

              {/* Display QR Code if payment exists and is unpaid */}
              {payment && payment.status === 'unpaid' && (
                <>
                  <Alert variant="info" className="mt-4">
                    {t('artworkDetail.payWithQr') || 'Proveďte prosím platbu za dílo pomocí QR kódu'}
                  </Alert>
                  <Card className="mt-2 border-primary">
                    <Card.Body>
                      <PaymentQRCode
                        bankAccount={payment!.bankAccountNumber}
                        galleryName={payment!.galleryName}
                        price={payment!.price}
                        variableSymbol={payment!.artworkId.toString()}
                        description={payment!.paymentDescriptionTemplate
                          ?.replace('%s', artwork.title)
                          .replace('%s', payment!.galleryName) || artwork.title}
                        paymentId={payment!.id}
                        createdAt={payment!.createdAt}
                      />
                    </Card.Body>
                  </Card>
                </>
              )}

              {/* Display paid status if payment is confirmed */}
              {payment && payment.status === 'paid' && (
                <Alert variant="success" className="mt-4">
                  <h5>✅ {t('payments.statusPaid') || 'Zaplaceno'}</h5>
                  {payment.confirmedAt && (
                    <p className="mb-0">
                      {new Date(payment.confirmedAt).toLocaleDateString('cs-CZ', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </Alert>
              )}

              {!isForSale && !isSold && !hasUnpaidReservation && (
                <Alert variant="info">
                  {t('artworkDetail.notAvailable') || 'Toto dílo momentálně není k prodeji'}
                </Alert>
              )}

              {isSold && (
                <Alert variant="secondary">
                  {t('artworkDetail.alreadyExhibited') || 'Toto dílo bylo vystaveno'}
                </Alert>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="history-card">
        <Card.Header>
          <h4>{t('artworkDetail.history') || 'Historie díla'}</h4>
        </Card.Header>
        <Card.Body>
          <ArtworkHistoryTable 
            events={events} 
            artworkTitle={artwork?.title || ''} 
            token={token}
            onlyApproved={true}
          />
        </Card.Body>
      </Card>

      {/* Offer Modal */}
      {artwork && (
        <OfferModal
          show={showOfferModal}
          artworkId={artwork.id}
          artworkTitle={artwork.title}
          onClose={() => setShowOfferModal(false)}
          onSuccess={() => {
            setSuccess(t('offers.offerSubmitted'));
            setOffersCount(offersCount + 1);
          }}
          token={token}
        />
      )}
      </Container>
    </PublicLayout>
  );
};

export default ArtworkDetailPage;
