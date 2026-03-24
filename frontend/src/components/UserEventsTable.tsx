import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import { useAppSelector } from '../hooks';
import { formatPrice } from '../utils/currency';
import axios from 'axios';
import './UserEventsTable.css';

interface UserEvent {
  id: number;
  artwork_title: string;
  type: string;
  status: string;
  created_at: string;
  approved_at?: string;
  details?: string;
  price?: number;
  owner_id?: number;
  owner_username?: string;
  owner_email?: string;
}

const UserEventsTable: React.FC = () => {
  const { token, user } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    setLoading(true);
    axios.get('/api/events', {
      headers: { Authorization: `Bearer ${token}` },
      params: { userId: user.id, status: 'all' }
    })
      .then(res => setEvents(res.data))
      .catch(err => {
        console.error('Error loading events:', err);
        setError(t('events.loadError'));
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('cs-CZ');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      'pending': 'warning',
      'approved': 'success',
      'rejected': 'danger'
    };
    const labels: Record<string, string> = {
      'pending': t('events.statusPending'),
      'approved': t('events.statusApproved'),
      'rejected': t('events.statusRejected')
    };
    return <Badge bg={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'created': t('events.typeCreated'),
      'updated': t('events.typeUpdated'),
      'price_change': t('events.typePriceChange'),
      'status_change': t('events.typeStatusChange'),
      'deleted': t('events.typeDeleted'),
      'ownership_change': t('events.typeOwnershipChange')
    };
    return labels[type] || type;
  };

  return (
    <div className="user-events grid-gap-md">
      {loading && <div className="text-center my-3"><Spinner animation="border" /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <Table striped bordered hover size="sm" responsive className="user-events-table">
          <thead className="table-light">
            <tr>
              <th className="col-id">{t('events.id')}</th>
              <th>{t('events.artwork')}</th>
              <th className="col-type">{t('events.type')}</th>
              <th className="col-created">{t('events.created')}</th>
              <th className="col-status">{t('events.status')}</th>
              <th>{t('gallery.owner') || 'Majitel'}</th>
              <th className="col-approved">{t('events.approved')}</th>
              <th className="col-price">{t('events.price')}</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr className="empty-row"><td colSpan={8} className="text-center text-muted">{t('events.noEvents')}</td></tr>
            ) : events.map(ev => (
              <tr key={ev.id}>
                <td>{ev.id}</td>
                <td><strong>{ev.artwork_title || '—'}</strong></td>
                <td>
                  <Badge bg="info" pill>{getTypeLabel(ev.type)}</Badge>
                </td>
                <td>{formatDate(ev.created_at)}</td>
                <td>{getStatusBadge(ev.status)}</td>
                <td className="owner-cell">
                  {ev.owner_username ? (
                    <div>
                      <strong>{ev.owner_username}</strong>
                      <small>{ev.owner_email}</small>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{formatDate(ev.approved_at)}</td>
                <td>{ev.price ? `${formatPrice(ev.price)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default UserEventsTable;
