import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../store';
import { getArtworkApprovals, approveEvent, rejectEvent, ArtworkApproval } from '../api/events';
import { Table, Button, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { formatPrice } from '../utils/currency';
import ArtworkHistoryTable from './ArtworkHistoryTable';
import './AdminArtworkApprovals.css';

const AdminArtworkApprovals: React.FC = () => {
  const { t } = useTranslation();
  const token = useSelector((state: RootState) => state.auth.token);
  const [artworks, setArtworks] = useState<ArtworkApproval[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<'all' | number>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('pending'); // all, approved, pending, rejected
  const [expandedArtworkId, setExpandedArtworkId] = useState<number | null>(null);
  const [modal, setModal] = useState<{
    show: boolean;
    eventId: number | null;
    action: 'approve' | 'reject' | null;
    reason: string;
  }>({
    show: false,
    eventId: null,
    action: null,
    reason: ''
  });

  const loadUsers = async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadArtworks = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const data = await getArtworkApprovals(token, approvalFilter, 200, 0);
      setArtworks(data.artworks);
    } catch (err: any) {
      setError(err.error || 'Chyba při načítání artwork');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadArtworks();
  }, [token, approvalFilter]);

  const handleApprove = async (eventId: number) => {
    if (!token) return;

    try {
      await approveEvent(token, eventId);
      await loadArtworks();
      setModal({ show: false, eventId: null, action: null, reason: '' });
    } catch (err: any) {
      setError(err.error || 'Chyba při schválení');
    }
  };

  const handleReject = async (eventId: number, reason: string) => {
    if (!token) return;

    try {
      await rejectEvent(token, eventId, reason);
      await loadArtworks();
      setModal({ show: false, eventId: null, action: null, reason: '' });
    } catch (err: any) {
      setError(err.error || 'Chyba při zamítnutí');
    }
  };

  const openModal = (eventId: number, action: 'approve' | 'reject') => {
    setModal({
      show: true,
      eventId,
      action,
      reason: ''
    });
  };

  const closeModal = () => {
    setModal({ show: false, eventId: null, action: null, reason: '' });
  };

  const handleModalSubmit = () => {
    if (!modal.eventId || !modal.action) return;

    if (modal.action === 'approve') {
      handleApprove(modal.eventId);
    } else if (modal.action === 'reject') {
      handleReject(modal.eventId, modal.reason);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('cs-CZ');
  };

  const getEventTypeBadgeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      created: 'success',
      updated: 'info',
      price_change: 'warning',
      status_change: 'primary',
      deleted: 'danger',
      ownership_change: 'secondary'
    };
    return colors[type] || 'secondary';
  };

  const getEventTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      created: t('artworkApprovals.typeCreated'),
      updated: t('artworkApprovals.typeUpdated'),
      price_change: t('artworkApprovals.typePriceChange'),
      status_change: t('artworkApprovals.typeStatusChange'),
      deleted: t('artworkApprovals.typeDeleted'),
      ownership_change: t('artworkApprovals.typeOwnershipChange')
    };
    return labels[type] || type;
  };

  const getArtworkStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      vystaveno: t('artworkApprovals.statusVystaveno'),
      zrušeno: t('artworkApprovals.statusZrušeno'),
      skryto: t('artworkApprovals.statusSkryto')
    };
    return labels[status] || status;
  };

  const getEventStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      approved: t('artworkApprovals.eventStatusApproved'),
      pending: t('artworkApprovals.eventStatusPending'),
      rejected: t('artworkApprovals.eventStatusRejected')
    };
    return labels[status] || status;
  };

  // Filtrování artwork podle vybraného uživatele a statusu
  const filteredArtworks = artworks.filter(artwork => {
    const userMatch = selectedUserId === 'all' ? true : artwork.userId === selectedUserId;
    
    if (approvalFilter === 'all') {
      return userMatch;
    } else if (approvalFilter === 'pending') {
      return userMatch && artwork.events && artwork.events.some(e => e.status === 'pending');
    } else if (approvalFilter === 'approved') {
      return userMatch && artwork.events && artwork.events.every(e => e.status === 'approved' || e.status === 'rejected');
    } else if (approvalFilter === 'rejected') {
      return userMatch && artwork.events && artwork.events.some(e => e.status === 'rejected');
    }
    return userMatch;
  });

  return (
    <div className="admin-artwork-approvals">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('artworkApprovals.artworkApprovals')}</h2>
      </div>

      <div className="approvals-filter">
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

        <div className="filter-group">
          <button
            className={`filter-btn filter-btn-compact ${approvalFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setApprovalFilter('pending')}
          >
            {t('artworkApprovals.pendingArtworks')} ({filteredArtworks.filter(a => 
              a.events && a.events.some(e => e.status === 'pending')
            ).length})
          </button>
          <button
            className={`filter-btn filter-btn-compact ${approvalFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setApprovalFilter('approved')}
          >
            {t('artworkApprovals.approvedArtworks')} ({filteredArtworks.filter(a =>
              a.events && a.events.every(e => e.status === 'approved' || e.status === 'rejected')
            ).length})
          </button>
          <button
            className={`filter-btn filter-btn-compact ${approvalFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setApprovalFilter('rejected')}
          >
            {t('artworkApprovals.rejectedArtworks')} ({filteredArtworks.filter(a =>
              a.events && a.events.some(e => e.status === 'rejected')
            ).length})
          </button>
          <button
            className={`filter-btn filter-btn-compact ${approvalFilter === 'all' ? 'active' : ''}`}
            onClick={() => setApprovalFilter('all')}
          >
            {t('artworkApprovals.allArtworks')} ({filteredArtworks.length})
          </button>
        </div>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {loading && (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">{t('artworkApprovals.loadingArtworks')}</span>
          </Spinner>
        </div>
      )}

      {!loading && filteredArtworks.length === 0 && (
        <Alert variant="info">{t('artworkApprovals.noArtworksWithEvents')}</Alert>
      )}

      {!loading && filteredArtworks.length > 0 && (
        <div className="artwork-approvals-table">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>{t('artworkApprovals.artwork')}</th>
                <th>{t('artworkApprovals.author')}</th>
                <th>{t('artworkApprovals.price')}</th>
                <th>{t('artworkApprovals.status')}</th>
                <th>{t('artworkApprovals.eventCount')}</th>
                <th>{t('artworkApprovals.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredArtworks.map((artwork) => (
                <React.Fragment key={artwork.id}>
                  <tr>
                    <td>
                      <strong>{artwork.title}</strong>
                      <br />
                      <small className="text-muted">{artwork.description?.substring(0, 50)}...</small>
                    </td>
                    <td>{artwork.creatorUsername}</td>
                    <td>{artwork.price ? `${formatPrice(artwork.price)}` : 'N/A'}</td>
                    <td>
                      <Badge bg={artwork.status === 'vystaveno' ? 'success' : 'danger'}>
                        {getArtworkStatusLabel(artwork.status)}
                      </Badge>
                    </td>
                    <td>{artwork.events?.length || 0}</td>
                    <td>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setExpandedArtworkId(expandedArtworkId === artwork.id ? null : artwork.id)}
                      >
                        {expandedArtworkId === artwork.id ? t('artworkApprovals.hideEvents') : t('artworkApprovals.showEvents')} {t('artworkApprovals.events')}
                      </Button>
                    </td>
                  </tr>

                  {expandedArtworkId === artwork.id && artwork.events && artwork.events.length > 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="ms-3">
                          <h6>{t('artworkDetail.history') || 'Historie díla'}: {artwork.title}</h6>
                          <ArtworkHistoryTable 
                            events={artwork.events}
                            artworkTitle={artwork.title}
                            token={token}
                            onlyApproved={false}
                          />
                          <h6 className="mt-4 mb-3">{t('artworkApprovals.pendingApprovals') || 'Čekající schválení'}</h6>
                          <Table size="sm" bordered>
                            <thead>
                              <tr>
                                <th>{t('artworkApprovals.type')}</th>
                                <th>{t('artworkApprovals.createdAt')}</th>
                                <th>{t('artworkApprovals.author')}</th>
                                <th>{t('artworkApprovals.price')}</th>
                                <th>{t('artworkApprovals.approvedAt')}</th>
                                <th>{t('artworkApprovals.status')}</th>
                                <th>{t('artworkApprovals.actions')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {artwork.events.map((event) => (
                                <tr key={event.id}>
                                  <td>
                                    <Badge bg={getEventTypeBadgeColor(event.type)}>
                                      {getEventTypeLabel(event.type)}
                                    </Badge>
                                  </td>
                                  <td>{formatDate(event.createdAt)}</td>
                                  <td>{event.creatorUsername}</td>
                                  <td>{event.price ? `${formatPrice(event.price)}` : 'N/A'}</td>
                                  <td>
                                    {event.approvedAt ? (
                                      <div>
                                        <div>{formatDate(event.approvedAt)}</div>
                                        <small className="text-muted">({event.approvedByUsername})</small>
                                      </div>
                                    ) : (
                                      <span className="text-muted">{t('artworkApprovals.notApproved')}</span>
                                    )}
                                  </td>
                                  <td>
                                    <Badge bg={event.status === 'approved' ? 'success' : event.status === 'pending' ? 'warning' : 'danger'}>
                                      {getEventStatusLabel(event.status)}
                                    </Badge>
                                  </td>
                                  <td>
                                    {event.status === 'pending' && (
                                      <div className="artwork-action-buttons">
                                        <Button
                                          variant="success"
                                          size="sm"
                                          onClick={() => openModal(event.id, 'approve')}
                                          className="me-1"
                                        >
                                          {t('artworkApprovals.approveButton')}
                                        </Button>
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => openModal(event.id, 'reject')}
                                        >
                                          {t('artworkApprovals.rejectButton')}
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal show={modal.show} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {modal.action === 'approve' ? t('artworkApprovals.approveEvent') : t('artworkApprovals.rejectEvent')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modal.action === 'reject' && (
            <Form.Group className="mb-3">
              <Form.Label>{t('artworkApprovals.rejectReason')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={modal.reason}
                onChange={(e) =>
                  setModal({ ...modal, reason: e.target.value })
                }
                placeholder={t('artworkApprovals.rejectPlaceholder')}
              />
            </Form.Group>
          )}
          <p>
            {modal.action === 'approve'
              ? t('artworkApprovals.confirmApproveEvent')
              : t('artworkApprovals.confirmRejectEvent')}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            {t('artworkApprovals.cancelButton')}
          </Button>
          <Button
            variant={modal.action === 'approve' ? 'success' : 'danger'}
            onClick={handleModalSubmit}
          >
            {modal.action === 'approve' ? t('artworkApprovals.approveButton') : t('artworkApprovals.rejectButton')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminArtworkApprovals;
