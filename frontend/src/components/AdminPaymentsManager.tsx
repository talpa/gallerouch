import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Container, Table, Button, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { formatPrice } from '../utils/currency';
import './AdminPaymentsManager.css';

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
  confirmedBy?: number;
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
  confirmerEmail?: string;
}

const AdminPaymentsManager: React.FC = () => {
  const { t } = useTranslation();
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'by-user'>('all');
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    paymentMethod: '',
    transactionId: '',
    notes: ''
  });
  
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError(t('payments.adminOnly') || 'Pouze pro administrátory');
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
      setPayments(response.data);
    } catch (err: any) {
      console.error('Error loading payments:', err);
      setError(err.response?.data?.error || t('payments.loadError') || 'Chyba načítání plateb');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfirmModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setConfirmForm({
      paymentMethod: '',
      transactionId: '',
      notes: ''
    });
    setShowConfirmModal(true);
  };

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
    setSelectedPayment(null);
    setConfirmForm({ paymentMethod: '', transactionId: '', notes: '' });
  };

  const handleConfirmPayment = async () => {
    if (!selectedPayment || !token) return;

    try {
      await axios.put(
        `/api/payments/${selectedPayment.id}/confirm`,
        confirmForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(t('payments.confirmSuccess') || 'Platba byla potvrzena');
      handleCloseConfirmModal();
      loadPayments();
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      setError(err.response?.data?.error || t('payments.confirmError') || 'Chyba potvrzení platby');
    }
  };

  const handleOpenInvoiceModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setInvoiceNumber(payment.invoiceNumber || '');
    setShowInvoiceModal(true);
  };

  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedPayment(null);
    setInvoiceNumber('');
  };

  const handleSendInvoice = async () => {
    if (!selectedPayment || !token || !invoiceNumber.trim()) {
      setError(t('payments.invoiceNumberRequired') || 'Číslo faktury je povinné');
      return;
    }

    try {
      await axios.put(
        `/api/payments/${selectedPayment.id}/invoice`,
        { invoiceNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(t('payments.invoiceSent') || 'Faktura byla označena jako odeslaná');
      handleCloseInvoiceModal();
      loadPayments();
    } catch (err: any) {
      console.error('Error sending invoice:', err);
      setError(err.response?.data?.error || t('payments.invoiceError') || 'Chyba při odesílání faktury');
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

  // Filter payments
  const filteredPayments = payments.filter(p => {
    if (filter === 'paid') return p.status === 'paid' || p.status === 'cancelled';
    if (filter === 'unpaid') return p.status === 'unpaid';
    return true;
  });

  // Calculate summaries
  const paidTotal = payments
    .filter(p => p.status === 'paid' || p.status === 'cancelled')
    .reduce((sum, p) => sum + Number(p.price), 0);

  const unpaidTotal = payments
    .filter(p => p.status === 'unpaid')
    .reduce((sum, p) => sum + Number(p.price), 0);

  const paidCount = payments.filter(p => p.status === 'paid' || p.status === 'cancelled').length;
  const unpaidCount = payments.filter(p => p.status === 'unpaid').length;

  const galleryCommissionTotal = payments
    .filter(p => p.status === 'paid' || p.status === 'cancelled')
    .reduce((sum, p) => sum + Number(p.galleryCommission), 0);

  const sellerAmountTotal = payments
    .filter(p => p.status === 'paid' || p.status === 'cancelled')
    .reduce((sum, p) => sum + Number(p.sellerAmount), 0);

  // Group payments by user (seller)
  const paymentsBySeller = payments.reduce((acc, payment) => {
    const sellerId = payment.sellerId;
    if (!acc[sellerId]) {
      acc[sellerId] = {
        sellerId,
        sellerName: payment.sellerName || 'N/A',
        sellerEmail: payment.sellerEmail || '',
        payments: [],
        paidTotal: 0,
        unpaidTotal: 0,
        paidCount: 0,
        unpaidCount: 0,
        sellerAmountPaid: 0
      };
    }
    acc[sellerId].payments.push(payment);
    if (payment.status === 'paid' || payment.status === 'cancelled') {
      acc[sellerId].paidTotal += Number(payment.price);
      acc[sellerId].paidCount++;
      acc[sellerId].sellerAmountPaid += Number(payment.sellerAmount);
    } else if (payment.status === 'unpaid') {
      acc[sellerId].unpaidTotal += Number(payment.price);
      acc[sellerId].unpaidCount++;
    }
    return acc;
  }, {} as Record<number, {
    sellerId: number;
    sellerName: string;
    sellerEmail: string;
    payments: Payment[];
    paidTotal: number;
    unpaidTotal: number;
    paidCount: number;
    unpaidCount: number;
    sellerAmountPaid: number;
  }>);

  const sellerSummaries = Object.values(paymentsBySeller);

  if (loading) {
    return (
      <Container className="admin-payments-manager mt-4">
        <div className="text-center">
          <Spinner animation="border" />
          <p>{t('common.loading') || 'Načítání...'}</p>
        </div>
      </Container>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <Container className="admin-payments-manager mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="admin-payments-manager mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('payments.title') || 'Správa plateb'}</h2>
        <Button variant="primary" onClick={loadPayments}>
           {t('buttons.refresh') || 'Obnovit'}
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

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
          <div className="summary-card commission">
            <div className="summary-label">{t('payments.commission') || 'Provize galerie'}</div>
            <div className="summary-amount">{formatPrice(galleryCommissionTotal)}</div>
          </div>
          <div className="summary-card sellers">
            <div className="summary-label">{t('payments.sellersTotal') || 'Celkem prodejcům'}</div>
            <div className="summary-amount">{formatPrice(sellerAmountTotal)}</div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {payments.length > 0 && (
        <div className="d-flex gap-2 mb-3">
          <Button 
            variant={viewMode === 'all' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('all')}
            size="sm"
          >
              {t('payments.viewAll') || 'Všechny platby'}
          </Button>
          <Button 
            variant={viewMode === 'by-user' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('by-user')}
            size="sm"
          >
              {t('payments.viewByUser') || 'Podle uživatele'}
          </Button>
        </div>
      )}

      {/* Filtry */}
      {payments.length > 0 && viewMode === 'all' && (
        <div className="payments-filters mb-4">
          <Button 
            variant={filter === 'all' ? 'primary' : 'outline-primary'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            {t('payments.filterAll') || 'Vše'} ({payments.length})
          </Button>
          <Button 
            variant={filter === 'paid' ? 'success' : 'outline-success'}
            onClick={() => setFilter('paid')}
            size="sm"
          >
            {t('payments.statusPaid') || 'Zaplaceno'} ({paidCount})
          </Button>
          <Button 
            variant={filter === 'unpaid' ? 'warning' : 'outline-warning'}
            onClick={() => setFilter('unpaid')}
            size="sm"
          >
            {t('payments.statusUnpaid') || 'Nezaplaceno'} ({unpaidCount})
          </Button>
        </div>
      )}

      {payments.length === 0 ? (
        <Alert variant="info">{t('payments.noPayments') || 'Zatím nejsou žádné platby'}</Alert>
      ) : viewMode === 'by-user' ? (
        /* Group By User View */
        <div className="user-groups">
          {sellerSummaries.map((seller) => (
            <div key={seller.sellerId} className="user-group-card mb-4">
              <div className="user-group-header">
                <h5>
                  {seller.sellerName}
                  <br />
                  <small className="text-muted">{seller.sellerEmail}</small>
                </h5>
                <div className="user-stats">
                  <Badge bg="success" className="me-2">
                    ✓ {seller.paidCount} ({formatPrice(seller.paidTotal)})
                  </Badge>
                  <Badge bg="warning">
                    ⏳ {seller.unpaidCount} ({formatPrice(seller.unpaidTotal)})
                  </Badge>
                  <Badge bg="info" className="ms-2">
                    💰 {formatPrice(seller.sellerAmountPaid)}
                  </Badge>
                </div>
              </div>
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>{t('payments.id') || 'ID'}</th>
                    <th>{t('payments.varSymbol') || 'Var. symbol'}</th>
                    <th>{t('payments.artwork') || 'Dílo'}</th>
                    <th>{t('payments.buyer') || 'Kupující'}</th>
                    <th>{t('payments.price') || 'Cena'}</th>
                    <th>{t('payments.commission') || 'Provize'}</th>
                    <th>{t('payments.sellerAmount') || 'Prodejci'}</th>
                    <th>{t('payments.status') || 'Stav'}</th>
                    <th>{t('payments.created') || 'Vytvořeno'}</th>
                    <th>{t('payments.actions') || 'Akce'}</th>
                  </tr>
                </thead>
                <tbody>
                  {seller.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.id}</td>
                      <td>
                        <code>{payment.variableSymbol || '-'}</code>
                        {payment.fioTransactionId && (
                          <>
                            <br />
                            <small className="text-success">✓ {payment.fioTransactionId.substring(0, 8)}...</small>
                          </>
                        )}
                      </td>
                      <td>
                        <strong>{payment.artworkTitle}</strong>
                        <br />
                        <small className="text-muted">ID: {payment.artworkId}</small>
                      </td>
                      <td>
                        {payment.buyerName || 'N/A'}
                        <br />
                        <small className="text-muted">{payment.buyerEmail}</small>
                      </td>
                      <td><strong>{formatPrice(payment.price)}</strong></td>
                      <td className="text-danger">{formatPrice(payment.galleryCommission)}</td>
                      <td className="text-success">{formatPrice(payment.sellerAmount)}</td>
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
                        <div className="d-flex gap-1 flex-wrap">
                          {payment.status === 'unpaid' && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleOpenConfirmModal(payment)}
                            >
                                {t('buttons.confirmPayment') || 'Potvrdit'}
                            </Button>
                          )}
                          {payment.status === 'paid' && !payment.invoiceSentAt && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenInvoiceModal(payment)}
                            >
                                {t('buttons.sendInvoice') || 'Faktura'}
                            </Button>
                          )}
                          {payment.invoiceSentAt && (
                            <Badge bg="info" className="d-flex align-items-center">
                              📄 {t('payments.invoiceSent') || 'Faktura odeslána'}
                              <br />
                              <small>{payment.invoiceNumber}</small>
                            </Badge>
                          )}
                        </div>
                        {payment.paidAt && (
                          <div className="mt-1">
                            <small className="text-muted">
                              {t('payments.paidAt') || 'Zaplaceno'}: {new Date(payment.paidAt).toLocaleDateString('cs-CZ')}
                            </small>
                          </div>
                        )}
                        {payment.notes && (
                          <div className="mt-1">
                            <small className="text-muted">{payment.notes}</small>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))}
        </div>
      ) : (
        /* All Payments View */
        <Table hover responsive className="payments-table">
          <thead>
            <tr>
              <th>{t('payments.id') || 'ID'}</th>
              <th>{t('payments.varSymbol') || 'Var. symbol'}</th>
              <th>{t('payments.artwork') || 'Dílo'}</th>
              <th>{t('payments.buyer') || 'Kupující'}</th>
              <th>{t('payments.seller') || 'Prodávající'}</th>
              <th>{t('payments.price') || 'Cena'}</th>
              <th>{t('payments.commission') || 'Provize'}</th>
              <th>{t('payments.sellerAmount') || 'Prodejci'}</th>
              <th>{t('payments.status') || 'Stav'}</th>
              <th>{t('payments.created') || 'Vytvořeno'}</th>
              <th>{t('payments.actions') || 'Akce'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
                <td>
                  <code>{payment.variableSymbol || '-'}</code>
                  {payment.fioTransactionId && (
                    <>
                      <br />
                      <small className="text-success">✓ {payment.fioTransactionId.substring(0, 8)}...</small>
                    </>
                  )}
                </td>
                <td>
                  <strong>{payment.artworkTitle}</strong>
                  <br />
                  <small className="text-muted">ID: {payment.artworkId}</small>
                </td>
                <td>
                  {payment.buyerName || 'N/A'}
                  <br />
                  <small className="text-muted">{payment.buyerEmail}</small>
                </td>
                <td>
                  {payment.sellerName || 'N/A'}
                  <br />
                  <small className="text-muted">{payment.sellerEmail}</small>
                </td>
                <td><strong>{formatPrice(payment.price)}</strong></td>
                <td className="text-danger">{formatPrice(payment.galleryCommission)}</td>
                <td className="text-success">{formatPrice(payment.sellerAmount)}</td>
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
                  <div className="d-flex gap-1 flex-wrap">
                    {payment.status === 'unpaid' && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleOpenConfirmModal(payment)}
                      >
                          {t('buttons.confirmPayment') || 'Potvrdit'}
                      </Button>
                    )}
                    {payment.status === 'paid' && !payment.invoiceSentAt && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenInvoiceModal(payment)}
                      >
                          {t('buttons.sendInvoice') || 'Faktura'}
                      </Button>
                    )}
                    {payment.invoiceSentAt && (
                      <Badge bg="info" className="d-flex align-items-center">
                        📄 {t('payments.invoiceSent') || 'Faktura odeslána'}
                        <br />
                        <small>{payment.invoiceNumber}</small>
                      </Badge>
                    )}
                  </div>
                  {payment.paidAt && (
                    <div className="mt-1">
                      <small className="text-muted">
                        {t('payments.paidAt') || 'Zaplaceno'}: {new Date(payment.paidAt).toLocaleDateString('cs-CZ')}
                      </small>
                    </div>
                  )}
                  {payment.notes && (
                    <div className="mt-1">
                      <small className="text-muted">{payment.notes}</small>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Confirm Payment Modal */}
      <Modal show={showConfirmModal} onHide={handleCloseConfirmModal}>
        <Modal.Header closeButton>
          <Modal.Title>{t('payments.confirmPaymentTitle') || 'Potvrdit platbu'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPayment && (
            <>
              <p>
                <strong>{t('payments.artwork') || 'Dílo'}:</strong> {selectedPayment.artworkTitle}
              </p>
              <p>
                <strong>{t('payments.buyer') || 'Kupující'}:</strong> {selectedPayment.buyerName} ({selectedPayment.buyerEmail})
              </p>
              <p>
                <strong>{t('payments.price') || 'Cena'}:</strong> {formatPrice(selectedPayment.price)}
              </p>
              
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>{t('payments.paymentMethod') || 'Způsob platby'}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('payments.paymentMethodPlaceholder') || 'např. Bankovní převod, Hotově'}
                    value={confirmForm.paymentMethod}
                    onChange={(e) => setConfirmForm({ ...confirmForm, paymentMethod: e.target.value })}
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>{t('payments.transactionId') || 'ID transakce'}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('payments.transactionIdPlaceholder') || 'Volitelné'}
                    value={confirmForm.transactionId}
                    onChange={(e) => setConfirmForm({ ...confirmForm, transactionId: e.target.value })}
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>{t('payments.notes') || 'Poznámky'}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder={t('payments.notesPlaceholder') || 'Volitelné poznámky'}
                    value={confirmForm.notes}
                    onChange={(e) => setConfirmForm({ ...confirmForm, notes: e.target.value })}
                  />
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseConfirmModal}>
            {t('buttons.cancel') || 'Zrušit'}
          </Button>
          <Button variant="success" onClick={handleConfirmPayment}>
            {t('buttons.confirmPayment') || 'Potvrdit platbu'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Invoice Modal */}
      <Modal show={showInvoiceModal} onHide={handleCloseInvoiceModal}>
        <Modal.Header closeButton>
          <Modal.Title>{t('payments.sendInvoiceTitle') || 'Odeslat fakturu'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPayment && (
            <>
              <p>
                <strong>{t('payments.artwork') || 'Dílo'}:</strong> {selectedPayment.artworkTitle}
              </p>
              <p>
                <strong>{t('payments.buyer') || 'Kupující'}:</strong> {selectedPayment.buyerName} ({selectedPayment.buyerEmail})
              </p>
              
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>{t('payments.invoiceNumber') || 'Číslo faktury'} *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('payments.invoiceNumberPlaceholder') || 'např. 2025001'}
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                  />
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseInvoiceModal}>
            {t('buttons.cancel') || 'Zrušit'}
          </Button>
          <Button variant="primary" onClick={handleSendInvoice}>
            {t('buttons.sendInvoice') || 'Odeslat fakturu'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminPaymentsManager;
