import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Form, ListGroup, Badge, Alert } from 'react-bootstrap';
import { useAppSelector } from '../hooks';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../utils/currency';

interface ArtworkEvent {
  id: number;
  artworkId: number;
  type: string;
  status: string;
  price: number;
  details: string;
  createdAt: string;
  approvedAt: string;
  createdByName?: string;
}

interface ArtworkEventsManagerProps {
  artworkId: number;
  onEventsUpdated?: () => void;
}

const ArtworkEventsManager: React.FC<ArtworkEventsManagerProps> = ({ artworkId, onEventsUpdated }) => {
  const { token } = useAppSelector(state => state.auth);
  const { t } = useTranslation();
  const [events, setEvents] = useState<ArtworkEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    selectedStatus: 'Vystaveno',
    price: 0,
    details: '',
  });

  const statusOptions = [
    { value: 'Skryto', label: '🔒 Skryto' },
    { value: 'Vystaveno', label: '🖼️ Vystaveno' },
    { value: 'K prodeji', label: '💰 K prodeji' },
    // Stav "Prodáno" již nepoužíváme; místo toho využíváme "Vystaveno" nebo "K Prodeji"
    { value: 'Zrušeno', label: '❌ Zrušeno' },
  ];

  // Map event type to display label
  const getEventTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      'created': 'Skryto',
      'status_change': 'Změna statusu',
      'updated': 'Aktualizováno',
      'price_change': 'Změna ceny',
      'deleted': 'Smazáno',
      'ownership_change': 'Změna vlastníka',
    };
    return typeMap[type] || type;
  };

  // Map approval status to display label with color
  const getApprovalStatusBadge = (status: string, approvedAt: string) => {
    const statusMap: Record<string, { label: string; bg: string }> = {
      'pending': { label: '⏳ Čeká na schválení', bg: 'warning' },
      'approved': { label: '✅ Schváleno', bg: 'success' },
      'rejected': { label: '❌ Zamítnuto', bg: 'danger' },
    };
    const statusInfo = statusMap[status] || { label: status, bg: 'secondary' };
    return <Badge bg={statusInfo.bg}>{statusInfo.label}</Badge>;
  };

  // Get event icon based on type
  const getEventIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      'created': '🎨',
      'status_change': '🔄',
      'updated': '✏️',
      'price_change': '💰',
      'deleted': '🗑️',
      'ownership_change': '👤',
    };
    return iconMap[type] || '📝';
  };

  // Format date safely
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('cs-CZ');
  };

  // Parse event details to extract status
  const parseEventDetails = (details: string): { status?: string; [key: string]: any } => {
    try {
      return typeof details === 'string' ? JSON.parse(details) : details;
    } catch (e) {
      return {};
    }
  };

  useEffect(() => {
    loadEvents();
  }, [artworkId]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/artworks/${artworkId}/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError('Chyba při načítání událostí');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Zakázat volbu historického stavu "Prodáno"
    if (formData.selectedStatus === 'Prodáno') {
      setError('Status "Prodáno" se již nepoužívá. Zvolte prosím "Vystaveno" nebo "K Prodeji".');
      return;
    }
    
    try {
      await axios.post(`/api/artworks/${artworkId}/events`, {
        type: 'status_change',
        price: formData.price,
        details: JSON.stringify({ status: formData.selectedStatus }),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Událost byla úspěšně přidána');
      setTimeout(() => setSuccess(null), 3000);
      
      setFormData({ selectedStatus: 'Vystaveno', price: 0, details: '' });
      loadEvents();
      onEventsUpdated?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při přidávání události');
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!window.confirm('Opravdu chcete smazat tuto událost?')) return;
    
    try {
      await axios.delete(`/api/artworks/${artworkId}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Událost byla úspěšně smazána');
      setTimeout(() => setSuccess(null), 3000);
      loadEvents();
      onEventsUpdated?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při mazání');
    }
  };

  const getStatusBadge = (details: string) => {
    for (const option of statusOptions) {
      if (details.includes(option.value)) {
        return <Badge bg="info">{option.label}</Badge>;
      }
    }
    return <Badge bg="secondary">📋 Aktualizace</Badge>;
  };

  const getLastStatus = (): string => {
    if (events.length === 0) return 'Vystaveno';
    for (const event of events) {
      if (event.type === 'status_change' || event.details) {
        for (const option of statusOptions) {
          if (event.details.includes(option.value)) {
            return option.value;
          }
        }
      }
    }
    return 'Vystaveno';
  };

  return (
    <div className="mt-3">
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}
      
      <div className="mb-4 p-3 bg-light rounded">
        <h6 className="mb-3">Aktuální status: {getStatusBadge(getLastStatus())}</h6>
      </div>

      <h6>Přidat novou událost</h6>
      <Form onSubmit={handleAddEvent} className="mb-4 p-3 border rounded">
        <Form.Group className="mb-3">
          <Form.Label>Status</Form.Label>
          <Form.Select
            value={formData.selectedStatus}
            onChange={e => setFormData({ ...formData, selectedStatus: e.target.value })}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Cena (Kč)</Form.Label>
          <Form.Control
            type="number"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Poznámka</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={formData.details}
            onChange={e => setFormData({ ...formData, details: e.target.value })}
            placeholder="Volitelná poznámka k této události..."
          />
        </Form.Group>

        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? '⏳ Přidávám...' : '➕ Přidat událost'}
        </Button>
      </Form>

      <h6>Historie událostí</h6>
      {events.length === 0 ? (
        <p className="text-muted">Žádné události</p>
      ) : (
        <ListGroup>
          {events.map(event => {
            const eventDetails = parseEventDetails(event.details);
            return (
            <ListGroup.Item key={event.id} className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="mb-2">
                  <strong>{getEventIcon(event.type)} {getEventTypeLabel(event.type)}</strong>
                  {eventDetails.status && (
                    <span className="ms-2">{getStatusBadge(eventDetails.status)}</span>
                  )}
                  <span className="ms-2">{getApprovalStatusBadge(event.status, event.approvedAt)}</span>
                </div>
                {event.details && !eventDetails.status && (
                  <div className="mb-1">
                    <small className="text-muted">Poznámka: {event.details}</small>
                  </div>
                )}
                {event.price > 0 && (
                  <div className="mb-1">
                    <small>💰 Cena: {formatPrice(event.price)}</small>
                  </div>
                )}
                <div className="text-muted small mt-1">
                  📅 {formatDate(event.createdAt)}
                  {event.createdByName && ` • Vytvořil: ${event.createdByName}`}
                  {event.approvedAt && ` • Schváleno: ${formatDate(event.approvedAt)}`}
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteEvent(event.id)}
                className="ms-2"
                title="Smazat"
              >
                🗑️
              </Button>
            </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
};

export default ArtworkEventsManager;
