import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../store';
import { getEvents, approveEvent, rejectEvent, Event } from '../api/events';
import { Table, Button, Modal, Form, Badge, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import './AdminApprovalsManager.css';
import './ArtworkList.css';

interface ApprovalModalState {
  show: boolean;
  eventId: number | null;
  action: 'approve' | 'reject' | null;
  reason: string;
}

const AdminApprovalsManager: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');
  const [users, setUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [modal, setModal] = useState<ApprovalModalState>({
    show: false,
    eventId: null,
    action: null,
    reason: ''
  });

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [token]);

  const loadEvents = useCallback(async () => {
    console.log('loadEvents called, token:', token ? 'present' : 'missing');
    if (!token) {
      console.log('No token, skipping loadEvents');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching events with status:', statusFilter);
      const data = await getEvents(token, statusFilter, 100, 0);
      console.log('Events loaded:', data.events.length, 'total:', data.total);
      setEvents(data.events);
      setTotalCount(data.total);
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError(err.error || 'Chyba při načítání schválení');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    loadEvents();
    loadUsers();
  }, [loadEvents, loadUsers]);

  const handleApprove = async (eventId: number) => {
    if (!token) return;
    
    try {
      await approveEvent(token, eventId);
      setEvents(events.filter(e => e.id !== eventId));
      setModal({ show: false, eventId: null, action: null, reason: '' });
      await loadEvents();
    } catch (err: any) {
      setError(err.error || 'Chyba při schválení');
    }
  };

  const handleReject = async (eventId: number, reason: string) => {
    if (!token) return;
    
    try {
      await rejectEvent(token, eventId, reason);
      setEvents(events.filter(e => e.id !== eventId));
      setModal({ show: false, eventId: null, action: null, reason: '' });
      await loadEvents();
    } catch (err: any) {
      setError(err.error || 'Chyba při zamítnutí');
    }
  };

  const openApprovalModal = (eventId: number, action: 'approve' | 'reject') => {
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
    if (!modal.eventId) return;
    
    if (modal.action === 'approve') {
      handleApprove(modal.eventId);
    } else if (modal.action === 'reject') {
      handleReject(modal.eventId, modal.reason);
    }
  };

  const getEventTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      created: t('events.typeCreated'),
      updated: t('events.typeCreated'),
      price_change: t('events.typePriceChange'),
      status_change: t('events.typeStatusChange'),
      deleted: t('events.typeDeleted'),
      ownership_change: t('events.typeOwnershipChange')
    };
    return labels[type] || type;
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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('cs-CZ');
  };

  // Filtrování událostí podle vybraného uživatele a statusu
  const filteredEvents = events.filter(event => {
    const userMatch = selectedUserId === 'all' ? true : event.created_by === selectedUserId;
    const statusMatch = statusFilter === 'all' ? true : event.status === statusFilter;
    return userMatch && statusMatch;
  });

  return (
    <div className="admin-approvals-manager">
      <h2>{t('events.approvals')}</h2>
      
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
            className={`filter-btn filter-btn-compact ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            {t('events.pending')} ({filteredEvents.filter(e => e.status === 'pending').length})
          </button>
          <button
            className={`filter-btn filter-btn-compact ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            {t('events.approved')} ({filteredEvents.filter(e => e.status === 'approved').length})
          </button>
          <button
            className={`filter-btn filter-btn-compact ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            {t('events.rejected')} ({filteredEvents.filter(e => e.status === 'rejected').length})
          </button>
          <button
            className={`filter-btn filter-btn-compact ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            {t('events.all')} ({filteredEvents.length})
          </button>
        </div>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {loading && (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">{t('events.loading')}</span>
          </Spinner>
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <Alert variant="info">{t('events.noEvents')}</Alert>
      )}

      {!loading && filteredEvents.length > 0 && (
        <div className="approvals-table">
          <Table striped bordered hover className="artwork-events-table">
            <thead className="table-light">
              <tr>
                <th>{t('events.id')}</th>
                <th>{t('events.artwork')}</th>
                <th>{t('events.type')}</th>
                <th>{t('events.createdBy')}</th>
                <th>{t('events.createdAt')}</th>
                <th>{t('gallery.owner') || 'Majitel'}</th>
                <th>{t('events.details')}</th>
                <th>{t('events.status')}</th>
                <th>{t('events.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td>#{event.id}</td>
                  <td>
                    <small>{event.artwork_title || `(ID: ${event.artwork_id})`}</small>
                  </td>
                  <td>
                    <Badge bg={getEventTypeBadgeColor(event.type)}>
                      {getEventTypeLabel(event.type)}
                    </Badge>
                  </td>
                  <td>
                    <small>{event.created_by_username}</small>
                  </td>
                  <td>
                    <small>{formatDate(event.created_at)}</small>
                  </td>
                  <td>
                    {event.owner_username ? (
                      <div>
                        <div><small><strong>{event.owner_username}</strong></small></div>
                        <small>{event.owner_email}</small>
                      </div>
                    ) : (
                      <small>—</small>
                    )}
                  </td>
                  <td>
                    <small>
                      {event.details && event.details.trim() !== '' && (
                        <details>
                          <summary>{t('events.showDetails')}</summary>
                          <pre className="mb-0 event-details-pre">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(event.details), null, 2);
                              } catch {
                                return event.details;
                              }
                            })()}
                          </pre>
                        </details>
                      )}
                    </small>
                  </td>
                  <td>
                    <Badge bg={
                      event.status === 'approved' ? 'success' :
                      event.status === 'rejected' ? 'danger' :
                      'warning'
                    }>
                      {event.status === 'pending' ? t('events.statusPending') :
                       event.status === 'approved' ? t('events.statusApproved') :
                       t('events.statusRejected')}
                    </Badge>
                  </td>
                  <td>
                    {event.status === 'pending' && (
                      <div className="btn-group btn-group-sm">
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => openApprovalModal(event.id, 'approve')}
                          title={t('events.approve')}
                        >
                          {t('events.approve')}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => openApprovalModal(event.id, 'reject')}
                          title={t('events.reject')}
                        >
                          {t('events.reject')}
                        </Button>
                      </div>
                    )}
                    {event.status !== 'pending' && event.approved_by_username && (
                      <small className="text-muted">
                        {event.status === 'approved' ? 'Schválil' : 'Zamítl'}: {event.approved_by_username}
                        {event.approved_at && <div>{formatDate(event.approved_at)}</div>}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Approval Modal */}
      <Modal show={modal.show} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modal.action === 'approve' ? t('events.approveEvent') : t('events.rejectEvent')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modal.action === 'reject' && (
            <Form.Group className="mb-3">
              <Form.Label>{t('events.reason')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={modal.reason}
                onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                placeholder={t('events.confirmReject')}
              />
            </Form.Group>
          )}
          {modal.action === 'approve' && (
            <p>{t('events.confirmApprove')}</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeModal}>
            {t('buttons.cancel')}
          </Button>
          <Button
            variant={modal.action === 'approve' ? 'outline-success' : 'outline-danger'}
            onClick={handleModalSubmit}
          >
            {modal.action === 'approve' ? t('events.approve') : t('events.reject')}
          </Button>
        </Modal.Footer>
      </Modal>

      <div className="mt-4 text-muted">
        <small>Celkem: {totalCount} položek</small>
      </div>
    </div>
  );
};

export default AdminApprovalsManager;
