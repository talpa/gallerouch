import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAppSelector } from '../hooks';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import { normalizeArrayPayload } from '../utils/apiPayload';
import './AdminGalleryManager.css';

interface ArtworkType {
  id: number;
  name: string;
  name_en?: string;
  description?: string;
  created_at?: string;
  artworks_count?: number;
  users_count?: number;
}

const AdminArtworkTypesManager: React.FC = () => {
  const { token } = useAppSelector(state => state.auth);
  const [types, setTypes] = useState<ArtworkType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<ArtworkType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      const res = await axios.get('/api/auth/artwork-types-admin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTypes(normalizeArrayPayload<ArtworkType>(res.data));
    } catch (err) {
      console.error('Failed to load artwork types:', err);
      setError('Chyba při načítání typů uměleckých děl');
    }
  };

  const handleEdit = (type: ArtworkType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      nameEn: type.name_en || '',
      description: type.description || ''
    });
    setShowModal(true);
  };

  const handleNewType = () => {
    setEditingType(null);
    setFormData({
      name: '',
      nameEn: '',
      description: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Opravdu chcete smazat typ "${name}"? Artwork budou mít artwork_type nastaven na NULL.`)) {
      return;
    }

    try {
      await axios.delete(`/api/auth/artwork-types-admin/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Typ "${name}" byl úspěšně smazán`);
      setTimeout(() => setSuccess(null), 3000);
      loadTypes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při mazání');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingType) {
        await axios.put(`/api/auth/artwork-types-admin/${editingType.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Typ byl úspěšně aktualizován');
      } else {
        await axios.post('/api/auth/artwork-types-admin', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Typ byl úspěšně vytvořen');
      }

      setTimeout(() => setSuccess(null), 3000);
      setShowModal(false);
      loadTypes();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při ukládání');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-gallery-manager">
      <h2>🎨 Správa typů uměleckých děl</h2>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

      <div className="mb-3">
        <Button variant="success" onClick={handleNewType}>Přidat nový typ</Button>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Název (CZ)</th>
            <th>Název (EN)</th>
            <th>Popis</th>
            <th>Počet díl</th>
            <th>Počet umělců</th>
            <th>Akce</th>
          </tr>
        </thead>
        <tbody>
          {types.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center text-muted">Zatím nejsou žádné typy</td>
            </tr>
          ) : (
            types.map(type => (
              <tr key={type.id}>
                <td>{type.id}</td>
                <td><strong>{type.name}</strong></td>
                <td>{type.name_en || '—'}</td>
                <td>{type.description || '—'}</td>
                <td><Badge bg="info">{type.artworks_count || 0}</Badge></td>
                <td><Badge bg="secondary">{type.users_count || 0}</Badge></td>
                <td>
                  <Button 
                    variant="warning" 
                    size="sm" 
                    onClick={() => handleEdit(type)}
                    className="me-2"
                  >
                    ✏️
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => handleDelete(type.id, type.name)}
                  >
                    🗑️
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingType ? 'Upravit typ' : 'Nový typ uměleckého díla'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Název (čeština) *</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Např. Obraz, Socha, Keramika"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Název (angličtina)</Form.Label>
              <Form.Control
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="Např. Painting, Sculpture, Ceramics"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Popis</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Stručný popis tohoto typu uměleckého díla"
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? '⏳ Ukládám...' : editingType ? '💾 Uložit' : '✅ Vytvořit'}
              </Button>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Zrušit
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default AdminArtworkTypesManager;
