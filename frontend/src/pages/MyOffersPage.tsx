import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Alert, Spinner, Button, Table } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { getMyOffers, getMySentOffers, markOfferAsRead, markBuyerOfferStatusAsRead, updateOfferStatus, PriceOffer } from '../api/offers';
import PublicLayout from '../components/PublicLayout';

export const MyOffersPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const auth = useSelector((state: RootState) => state.auth);
  const [receivedOffers, setReceivedOffers] = useState<PriceOffer[]>([]);
  const [sentOffers, setSentOffers] = useState<PriceOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    if (!auth.token) return;

    setLoading(true);
    try {
      const [received, sent] = await Promise.all([
        getMyOffers(auth.token),
        getMySentOffers(auth.token)
      ]);
      setReceivedOffers(received);
      setSentOffers(sent);
      setError(null);
    } catch (err) {
      setError(t('common.error'));
      console.error('Error fetching offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (offerId: number) => {
    if (!auth.token) return;

    try {
      await markOfferAsRead(offerId, auth.token);
      setReceivedOffers(receivedOffers.map((o) => (o.id === offerId ? { ...o, read_at: new Date().toISOString() } : o)));
    } catch (err) {
      console.error('Error marking offer as read:', err);
    }
  };

  const handleMarkBuyerStatusAsRead = async (offerId: number) => {
    if (!auth.token) return;

    try {
      await markBuyerOfferStatusAsRead(offerId, auth.token);
      setSentOffers(sentOffers.map((o) => (o.id === offerId ? { ...o, buyer_read_at: new Date().toISOString() } : o)));
    } catch (err) {
      console.error('Error marking buyer status as read:', err);
    }
  };

  const handleUpdateStatus = async (offerId: number, status: 'accepted' | 'rejected') => {
    if (!auth.token) return;

    try {
      const updated = await updateOfferStatus(offerId, status, auth.token);
      setReceivedOffers(receivedOffers.map((o) => (o.id === offerId ? updated : o)));
    } catch (err) {
      console.error('Error updating offer status:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge bg="warning">{t('offers.statusPending')}</Badge>;
      case 'accepted':
        return <Badge bg="success">{t('offers.statusAccepted')}</Badge>;
      case 'rejected':
        return <Badge bg="danger">{t('offers.statusRejected')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  if (!auth.token || !auth.user) {
    return (
      <PublicLayout>
        <Container className="my-offers-page py-5">
          <Alert variant="warning">
            {t('offers.loginRequired') || 'Pro zobrazení nabídek se musíte přihlásit'}
          </Alert>
          <Button variant="primary" onClick={() => navigate('/login')}>
            {t('common.login') || 'Přihlásit se'}
          </Button>
        </Container>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Container className="my-offers-page py-5">
        <Row className="mb-4">
          <Col>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h1>💰 {t('offers.offersReceived')}</h1>
                <p className="text-muted">{t('offers.viewOffers')}</p>
              </div>
              <Button 
                variant="link" 
                onClick={() => navigate('/')}
                className="p-0"
              >
                ← {t('buttons.backToGallery') || 'Zpět do galerie'}
              </Button>
            </div>
          </Col>
        </Row>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">{t('common.loading')}</p>
        </div>
      ) : (
        <>
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <h5 className="mb-3">{t('offers.offersReceived')}</h5>
            {receivedOffers.length === 0 ? (
              <Alert variant="info" className="mb-0">{t('offers.noOffers')}</Alert>
            ) : (
            <Table striped bordered hover responsive className="mb-0">
            <thead>
              <tr>
                <th>{t('offers.artwork')}</th>
                <th>{t('offers.buyer')}</th>
                <th>{t('offers.offeredPrice')}</th>
                <th>{t('offers.createdAt')}</th>
                <th>{t('offers.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {receivedOffers.map((offer) => (
                <tr key={offer.id} className={!offer.read_at ? 'unread-offer' : ''}>
                  <td>
                    <strong>{offer.artwork_title}</strong>
                    {!offer.read_at && (
                      <Badge bg="danger" className="ms-2">
                        {t('offers.unread')}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div>{offer.buyer_username}</div>
                    <small className="text-muted">{offer.buyer_email}</small>
                    {offer.message && (
                      <div className="mt-2">
                        <small>
                          <strong>{t('offers.message')}:</strong> {offer.message}
                        </small>
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{formatPrice(offer.offered_price)}</strong>
                  </td>
                  <td>{formatDate(offer.created_at)}</td>
                  <td>{getStatusBadge(offer.status)}</td>
                  <td>
                    <div className="d-flex flex-column gap-1">
                      {!offer.read_at && (
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => handleMarkAsRead(offer.id)}
                          className="d-flex align-items-center justify-content-center py-1 px-2"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <span className="me-1">👁</span> {t('offers.markAsRead')}
                        </Button>
                      )}
                      {offer.status === 'pending' && (
                        <div className="d-flex gap-1">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleUpdateStatus(offer.id, 'accepted')}
                            className="flex-fill d-flex align-items-center justify-content-center py-1 px-2"
                            style={{ fontSize: '0.8rem' }}
                          >
                            <span className="me-1">✓</span> {t('offers.accept')}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleUpdateStatus(offer.id, 'rejected')}
                            className="flex-fill d-flex align-items-center justify-content-center py-1 px-2"
                            style={{ fontSize: '0.8rem' }}
                          >
                            <span className="me-1">✗</span> {t('offers.reject')}
                          </Button>
                        </div>
                      )}
                      {offer.status !== 'pending' && (
                        <small className="text-muted text-center">
                          {offer.status === 'accepted' && '✓ ' + (t('offers.statusAccepted') || 'Přijato')}
                          {offer.status === 'rejected' && '✗ ' + (t('offers.statusRejected') || 'Zamítnuto')}
                        </small>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
            )}
          </Card.Body>
        </Card>

        <Card className="shadow-sm">
          <Card.Body>
            <h5 className="mb-3">{t('offers.myOffers')}</h5>
            {sentOffers.length === 0 ? (
              <Alert variant="info" className="mb-0">{t('offers.noOffers')}</Alert>
            ) : (
              <Table striped bordered hover responsive className="mb-0">
                <thead>
                  <tr>
                    <th>{t('offers.artwork')}</th>
                    <th>Majitel</th>
                    <th>{t('offers.offeredPrice')}</th>
                    <th>{t('offers.createdAt')}</th>
                    <th>{t('offers.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sentOffers.map((offer) => {
                    const hasUnreadStatus = (offer.status === 'accepted' || offer.status === 'rejected') && !offer.buyer_read_at;
                    return (
                      <tr key={offer.id} className={hasUnreadStatus ? 'unread-offer' : ''}>
                        <td>
                          <strong>{offer.artwork_title}</strong>
                          {hasUnreadStatus && (
                            <Badge bg="danger" className="ms-2">
                              {t('offers.unread')}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div>{offer.owner_username}</div>
                          <small className="text-muted">{offer.owner_email}</small>
                        </td>
                        <td>
                          <strong>{formatPrice(offer.offered_price)}</strong>
                        </td>
                        <td>{formatDate(offer.created_at)}</td>
                        <td>{getStatusBadge(offer.status)}</td>
                        <td>
                          {hasUnreadStatus ? (
                            <Button
                              variant="info"
                              size="sm"
                              onClick={() => handleMarkBuyerStatusAsRead(offer.id)}
                              className="d-flex align-items-center justify-content-center py-1 px-2"
                              style={{ fontSize: '0.8rem' }}
                            >
                              <span className="me-1">👁</span> {t('offers.markAsRead')}
                            </Button>
                          ) : (
                            <small className="text-muted">
                              {offer.status === 'pending' ? t('offers.statusPending') : '✓'}
                            </small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
        </>
      )}
      </Container>
    </PublicLayout>
  );
};

export default MyOffersPage;
