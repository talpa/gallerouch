import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Table, Badge, Alert, Spinner } from 'react-bootstrap';
import { formatPrice } from '../utils/currency';
import './ArtworkList.css';

interface ArtworkEvent {
  id: number;
  artworkId?: number;
  artwork_id?: number;
  type: string;
  status: string;
  details?: string;
  createdBy?: number;
  created_by?: number;
  createdByName?: string;
  created_by_username?: string;
  createdByEmail?: string;
  price?: number;
  approvedAt?: string;
  approved_at?: string;
  approvedBy?: number;
  approved_by?: number;
  ownerId?: number;
  owner_id?: number;
  ownerName?: string;
  owner_username?: string;
  ownerEmail?: string;
  owner_email?: string;
  createdAt: string;
  created_at?: string;
  creatorUsername?: string;
  approvedByUsername?: string;
  approved_by_username?: string;
}

interface ArtworkHistoryTableProps {
  events: ArtworkEvent[];
  artworkTitle: string;
  token?: string | null;
  onlyApproved?: boolean;
}

const ArtworkHistoryTable: React.FC<ArtworkHistoryTableProps> = ({ 
  events, 
  artworkTitle, 
  token,
  onlyApproved = true 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [usernamesById, setUsernamesById] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needsUsernames = events.some((e) => {
      try {
        const d = JSON.parse(e.details || '{}');
        return d.previousOwnerId || d.newOwnerId;
      } catch {
        return false;
      }
    });
    if (needsUsernames && token) {
      loadUsernames();
    }
  }, [events, token]);

  const loadUsernames = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/auth/users/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const map: Record<number, string> = {};
      for (const u of res.data) {
        map[u.id] = u.username;
      }
      setUsernamesById(map);
    } catch (err) {
      console.error('Failed to load usernames list', err);
    } finally {
      setLoading(false);
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
    if (status === 'prodáno') return 'success';
    if (status === 'rezervováno') return 'warning';
    if (status === 'k_prodeji') return 'primary';
    if (status === 'vystaveno') return 'info';
    if (status === 'skryto') return 'secondary';
    return 'secondary';
  };

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

  const parseEventDetails = (detailsJson: string) => {
    try {
      return JSON.parse(detailsJson);
    } catch {
      return {};
    }
  };

  // Filter events based on approval status
  const displayedEvents = onlyApproved 
    ? events.filter((e) => (e.approvedAt || e.approved_at) && e.status === 'approved')
    : events;

  // Sort by creation date descending
  const sortedEvents = [...displayedEvents].sort(
    (a, b) => new Date(b.createdAt || b.created_at || '').getTime() - new Date(a.createdAt || a.created_at || '').getTime()
  );

  if (loading) {
    return (
      <div className="text-center">
        <Spinner animation="border" role="status" size="sm">
          <span className="visually-hidden">{t('common.loading') || 'Načítání...'}</span>
        </Spinner>
      </div>
    );
  }

  if (sortedEvents.length === 0) {
    return (
      <Alert variant="info">
        {onlyApproved 
          ? t('artworkDetail.noHistory') || 'Žádná schválená historie'
          : 'Žádné události'}
      </Alert>
    );
  }

  return (
    <Table hover responsive>
      <thead>
        <tr>
          <th>{t('artworkDetail.date') || 'Datum'}</th>
          <th>{t('artworkDetail.eventType') || 'Typ události'}</th>
          <th>{t('artworkDetail.status') || 'Stav'}</th>
          <th>{t('artworkDetail.price') || 'Cena'}</th>
          <th>{t('gallery.owner') || 'Majitel'}</th>
          <th>{t('artworkDetail.details') || 'Detaily'}</th>
        </tr>
      </thead>
      <tbody>
        {sortedEvents.map((event) => {
          const details = parseEventDetails(event.details || '');
          return (
            <tr key={event.id}>
              <td>
                {new Date(event.createdAt || event.created_at || '').toLocaleDateString('cs-CZ', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </td>
              <td>{getEventTypeLabel(event.type)}</td>
              <td>
                {details.status && (
                  <Badge bg={getStatusBadgeVariant(
                    details.status.toLowerCase().replace(' ', '_')
                  )}>
                    {getStatusLabel(details.status.toLowerCase().replace(' ', '_'))}
                  </Badge>
                )}
              </td>
              <td>
                {(event.price ?? 0) > 0 ? formatPrice(event.price ?? 0) : '-'}
              </td>
              <td>
                {(() => {
                  const prevId = details.previousOwnerId as number | undefined;
                  const newId = (details.newOwnerId as number | undefined) ?? ((event.ownerId || event.owner_id) as number | undefined);
                  const hasOwnershipChange = prevId || newId;
                  if (hasOwnershipChange) {
                    const prevLabel = prevId ? (usernamesById[prevId] || `#${prevId}`) : '-';
                    const newLabel = newId ? (usernamesById[newId] || event.ownerName || event.owner_username || `#${newId}`) : (event.ownerName || event.owner_username || '-');
                    return (
                      <div>
                        {prevId ? (
                          <button
                            className="user-profile-link"
                            onClick={() => navigate(`/gallery/owner/${prevId}`)}
                            style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            {prevLabel}
                          </button>
                        ) : (
                          <span>-</span>
                        )}
                        <span> → </span>
                        {newId ? (
                          <button
                            className="user-profile-link"
                            onClick={() => navigate(`/gallery/owner/${newId}`)}
                            style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            {newLabel}
                          </button>
                        ) : (
                          <span>{newLabel}</span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div>
                      {(event.ownerName || event.owner_username) ? (
                        <button
                          className="user-profile-link"
                          onClick={() => navigate(`/gallery/owner/${event.ownerId || event.owner_id}`)}
                          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          {event.ownerName || event.owner_username}
                        </button>
                      ) : (
                        '-'
                      )}
                      {(event.ownerEmail || event.owner_email) && (
                        <div><small>{event.ownerEmail || event.owner_email}</small></div>
                      )}
                    </div>
                  );
                })()}
              </td>
              <td>
                {details.title && details.title !== artworkTitle && (
                  <div><small>Název: {details.title}</small></div>
                )}
                {details.description && (
                  <div><small>{details.description}</small></div>
                )}
                {details.reason && (
                  <div><small className="text-muted">{
                    ((): string => {
                      const reason: string = details.reason;
                      if (reason === 'Payment confirmed') {
                        return t('payments.paymentConfirmed') || 'Platba potvrzena';
                      }
                      return reason;
                    })()
                  }</small></div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

export default ArtworkHistoryTable;
