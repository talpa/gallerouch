import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Container, Table, Badge, Alert, Spinner, Button } from 'react-bootstrap';
import { formatPrice } from '../utils/currency';
import { normalizeArrayPayload } from '../utils/apiPayload';
import './UserPaymentsManager.css';

interface Payment {
  id: number;
  artworkId: number;
  buyerId: number;
  sellerId: number;
  price: number;
  galleryCommission: number;
  sellerAmount: number;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
  createdAt: string;
  paidAt?: string;
  confirmedAt?: string;
  invoiceSentAt?: string;
  invoiceNumber?: string;
  variableSymbol?: string;
  fioTransactionId?: string;
  fioMatchedAt?: string;
  artworkTitle?: string;
  buyerEmail?: string;
  buyerName?: string;
  sellerEmail?: string;
  sellerName?: string;
}

const UserPaymentsManager: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    if (!user || !token) {
      setError(t('payments.loginRequired') || 'Musíte být přihlášeni');
      setLoading(false);
      return;
    }
    loadPayments();
  }, [user, token]);

  const loadPayments = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/payments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Already filtered by backend to user's payments (as buyer or seller)
      setPayments(normalizeArrayPayload<Payment>(response.data));
    } catch (err: any) {
      console.error('Error loading payments:', err);
      setError(err.response?.data?.error || t('payments.loadError') || 'Chyba načítání plateb');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: string } = {
      unpaid: 'warning',
      paid: 'success',
      cancelled: 'secondary'
    };
    
    const labels: { [key: string]: string } = {
      unpaid: t('payments.statusUnpaid') || 'Nezaplaceno',
      paid: t('payments.statusPaid') || 'Zaplaceno',
      cancelled: t('payments.statusCancelled') || 'Zrušeno'
    };
    
    return <Badge bg={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const getUserRole = (payment: Payment): 'buyer' | 'seller' => {
    return payment.buyerId === user?.id ? 'buyer' : 'seller';
  };

  const handleArtworkClick = (artworkId: number) => {
    navigate(`/artwork/${artworkId}`);
  };

  // Filtruj platby podle filtru
  const filteredPayments = payments.filter(p => {
    if (filter === 'paid') return p.status === 'paid' || p.status === 'cancelled';
    if (filter === 'unpaid') return p.status === 'unpaid';
    return true;
  });

  // Vypočítej sumarizaci
  const paidTotal = payments
    .filter(p => p.status === 'paid' || p.status === 'cancelled')
    .reduce((sum, p) => sum + Number(p.buyerId === user?.id ? p.price : p.sellerAmount), 0);

  const unpaidTotal = payments
    .filter(p => p.status === 'unpaid')
    .reduce((sum, p) => sum + Number(p.buyerId === user?.id ? p.price : p.sellerAmount), 0);

  const paidCount = payments.filter(p => p.status === 'paid' || p.status === 'cancelled').length;
  const unpaidCount = payments.filter(p => p.status === 'unpaid').length;

  if (loading) {
    return (
      <Container className="user-payments-manager mt-4">
        <div className="text-center">
          <Spinner animation="border" />
          <p>{t('common.loading') || 'Načítání...'}</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="user-payments-manager mt-4">
      <div className="payments-header d-flex justify-content-between align-items-center mb-4">
        <h2>{t('payments.myPayments') || 'Moje platby'}</h2>
        <Button variant="primary" onClick={loadPayments} size="sm">
          🔄 {t('buttons.refresh') || 'Obnovit'}
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

      {/* Sumarizace */}
      {payments.length > 0 && (
        <div className="payments-summary mb-4">
          <div className="summary-card paid">
            <div className="summary-label">{t('payments.statusPaid') || 'Zaplaceno'}</div>
            <div className="summary-count">{paidCount}</div>
            <div className="summary-amount">{formatPrice(paidTotal)}</div>
          </div>
          <div className="summary-card unpaid">
            <div className="summary-label">{t('payments.statusUnpaid') || 'Nezaplaceno'}</div>
            <div className="summary-count">{unpaidCount}</div>
            <div className="summary-amount">{formatPrice(unpaidTotal)}</div>
          </div>
        </div>
      )}

      {/* Filtry */}
      {payments.length > 0 && (
        <div className="payments-filters mb-4">
          <Button 
            variant={filter === 'all' ? 'primary' : 'outline-primary'}
            size="sm"
            onClick={() => setFilter('all')}
            className="payments-filter-btn me-2"
          >
            Všechny ({payments.length})
          </Button>
          <Button 
            variant={filter === 'paid' ? 'success' : 'outline-success'}
            size="sm"
            onClick={() => setFilter('paid')}
            className="payments-filter-btn me-2"
          >
            ✓ Zaplacené ({paidCount})
          </Button>
          <Button 
            variant={filter === 'unpaid' ? 'warning' : 'outline-warning'}
            size="sm"
            onClick={() => setFilter('unpaid')}
            className="payments-filter-btn"
          >
            ⏱ Čekající ({unpaidCount})
          </Button>
        </div>
      )}

      {payments.length === 0 ? (
        <Alert variant="info">{t('payments.noPayments') || 'Zatím nejsou žádné platby'}</Alert>
      ) : (
        <Table hover responsive className="payments-table">
          <thead>
            <tr>
              <th>{t('payments.artwork') || 'Dílo'}</th>
              <th>{t('payments.varSymbol') || 'Var. symbol'}</th>
              <th>{t('payments.role') || 'Role'}</th>
              <th>{t('payments.price') || 'Cena'}</th>
              <th>{t('payments.status') || 'Stav'}</th>
              <th>{t('payments.created') || 'Vytvořeno'}</th>
              {/* Paid date column */}
              <th>{t('payments.paidAt') || 'Zaplaceno'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => {
              const role = getUserRole(payment);
              const isBuyer = role === 'buyer';
              
              return (
                <tr key={payment.id}>
                  <td>
                    <button 
                      className="artwork-link"
                      onClick={() => handleArtworkClick(payment.artworkId)}
                      title={t('payments.viewArtwork') || 'Zobrazit dílo'}
                    >
                      <strong>{payment.artworkTitle}</strong>
                      <br />
                      <small className="text-muted">ID: {payment.artworkId}</small>
                    </button>
                  </td>
                  <td>
                    <code>{payment.variableSymbol || '-'}</code>
                    {payment.fioTransactionId && (
                      <div>
                        <small className="text-success">✓ Spárování</small>
                      </div>
                    )}
                  </td>
                  <td>
                    {isBuyer ? (
                      <Badge bg="info">{t('payments.buyer') || 'Kupující'}</Badge>
                    ) : (
                      <Badge bg="primary">{t('payments.seller') || 'Prodávající'}</Badge>
                    )}
                  </td>
                  <td>
                    <strong>{formatPrice(payment.price)}</strong>
                    {!isBuyer && payment.sellerAmount > 0 && (
                      <>
                        <br />
                        <small className="text-success">
                          {t('payments.sellerAmount') || 'Vám'}: {formatPrice(payment.sellerAmount)}
                        </small>
                      </>
                    )}
                  </td>
                  <td>{getStatusBadge(payment.status)}</td>
                  <td>
                    {new Date(payment.createdAt).toLocaleDateString('cs-CZ', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    {payment.confirmedAt ? (
                      new Date(payment.confirmedAt).toLocaleDateString('cs-CZ', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Container>
  );
};

export default UserPaymentsManager;
