import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Table, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import axios from 'axios';
import './ArtworkEventsTable.css';

interface Event {
  id: number;
  title: string;
  description: string;
  event_date: string;
  location: string;
  status: string;
  artwork_id: number;
  created_at: string;
}

const UserApprovalsManager: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const loadUserEvents = async () => {
    if (!token || !user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/events', {
        headers: { Authorization: `Bearer ${token}` },
        params: { userId: user.id }
      });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Error loading user events:', err);
      setError(err.response?.data?.error || 'Chyba při načítání událostí');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserEvents();
  }, [token, user?.id]);

  const handleDeleteEvent = async (eventId: number) => {
    if (!window.confirm('Opravdu chcete smazat tuto událost?')) return;

    try {
      await axios.delete(`/api/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadUserEvents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při mazání');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge bg="warning">Čeká na schválení</Badge>;
      case 'approved':
        return <Badge bg="success">Schváleno</Badge>;
      case 'rejected':
        return <Badge bg="danger">Zamítnuto</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => e.status === filter);

  const canDelete = (event: Event) => event.status === 'pending';

  return (
    <div className="user-approvals-manager">
      <h2>Moje Události</h2>
      
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      
      <div className="mb-3">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-outline-secondary ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Všechny
          </button>
          <button
            type="button"
            className={`btn btn-outline-warning ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Čeká na schválení
          </button>
          <button
            type="button"
            className={`btn btn-outline-success ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            Schválené
          </button>
          <button
            type="button"
            className={`btn btn-outline-danger ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Zamítnuté
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Načítám...</span>
        </Spinner>
      ) : filteredEvents.length === 0 ? (
        <Alert variant="info">Žádné události</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th>Název</th>
              <th>Datum</th>
              <th>Místo</th>
              <th>Status</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(event => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{new Date(event.event_date).toLocaleDateString('cs-CZ')}</td>
                <td>{event.location}</td>
                <td>{getStatusBadge(event.status)}</td>
                <td>
                  {canDelete(event) && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteEvent(event.id)}
                      title="Smazat událost"
                    >
                      🗑️ Smazat
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default UserApprovalsManager;
