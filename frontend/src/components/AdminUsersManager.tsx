import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { useAppSelector } from '../hooks';
import 'bootstrap/dist/css/bootstrap.min.css';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  profile_approved?: boolean;
  profile_approved_at?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  birth_number?: string;
  permanent_address?: string;
  permanent_city?: string;
  permanent_postal_code?: string;
  country?: string;
  bank_account_number?: string;
  bank_code?: string;
  bank_name?: string;
}

type EditMode = 
  | { type: 'create' } 
  | { type: 'edit'; user: User } 
  | { type: 'edit_profile'; user: User }
  | null;

const AdminUsersManager: React.FC = () => {
  const { token, user } = useAppSelector(state => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortKey, setSortKey] = useState<'username'|'email'|'role'|'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [mode, setMode] = useState<EditMode>(null);
  const [form, setForm] = useState<{ username: string; email: string; role: string; password?: string }>({ username: '', email: '', role: 'user' });
  const [profileForm, setProfileForm] = useState({
    address: '',
    city: '',
    postal_code: '',
    birth_number: '',
    permanent_address: '',
    permanent_city: '',
    permanent_postal_code: '',
    country: 'Česká republika',
    bank_account_number: '',
    bank_code: '',
    bank_name: '',
  });

  useEffect(() => {
    // Reload when token changes (e.g., after login)
    if (token && user?.role === 'admin') {
      loadUsers();
    }
  }, [token, user?.role]);

  // Handle URL parameter for auto-edit
  useEffect(() => {
    const editUserId = searchParams.get('edit');
    if (editUserId && users.length > 0) {
      const userToEdit = users.find(u => u.id === parseInt(editUserId));
      if (userToEdit) {
        openEdit(userToEdit);
        // Clear the URL parameter
        setSearchParams({});
      }
    }
  }, [searchParams, users]);

  // Debounce query input to reduce re-renders
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.debug('Loaded users count:', Array.isArray(res.data) ? res.data.length : 'non-array');
      setUsers(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.response?.data?.error || 'Chyba při načítání uživatelů');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    const filtered = users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [users, query, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const openCreate = () => {
    setForm({ username: '', email: '', role: 'user', password: '' });
    setMode({ type: 'create' });
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, email: u.email, role: u.role });
    setMode({ type: 'edit', user: u });
  };

  const openEditProfile = (u: User) => {
    setProfileForm({
      address: u.address || '',
      city: u.city || '',
      postal_code: u.postal_code || '',
      birth_number: u.birth_number || '',
      permanent_address: u.permanent_address || '',
      permanent_city: u.permanent_city || '',
      permanent_postal_code: u.permanent_postal_code || '',
      country: u.country || 'Česká republika',
      bank_account_number: u.bank_account_number || '',
      bank_code: u.bank_code || '',
      bank_name: u.bank_name || '',
    });
    setMode({ type: 'edit_profile', user: u });
  };

  const closeModal = () => {
    setMode(null);
  };

  const submitForm = async () => {
    try {
      if (mode?.type === 'create') {
        await axios.post('/api/auth/users', form, { headers: { Authorization: `Bearer ${token}` } });
      } else if (mode?.type === 'edit' && mode.user) {
        await axios.put(`/api/auth/users/${mode.user.id}`, form, { headers: { Authorization: `Bearer ${token}` } });
      } else if (mode?.type === 'edit_profile' && mode.user) {
        await axios.put(`/api/auth/users/${mode.user.id}/profile`, profileForm, { headers: { Authorization: `Bearer ${token}` } });
      }
      closeModal();
      await loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Operace selhala');
    }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Opravdu smazat uživatele ${u.username}?`)) return;
    try {
      await axios.delete(`/api/auth/users/${u.id}`, { headers: { Authorization: `Bearer ${token}` } });
      await loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Mazání selhalo');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (user?.role !== 'admin') {
    return <div className="alert alert-danger">Přístup pouze pro administrátory</div>;
  }

  if (loading) {
    return <div className="text-center mt-5">Načítám uživatele...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Správa uživatelů</h2>
        <div className="d-flex gap-2">
          <Form.Control
            placeholder="🔍 Hledat (jméno, email, role)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <Button variant="outline-secondary" onClick={() => { setQuery(''); }}>
            🗑️ Vyčistit
          </Button>
          <Button variant="success" onClick={openCreate}>
            ➕ Nový uživatel
          </Button>
          <Button variant="primary" onClick={loadUsers}>
            🔄 Obnovit
          </Button>
        </div>
      </div>
      
      <Table striped bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th className="sortable-header" onClick={() => toggleSort('username')}>
              Uživatelské jméno {sortKey==='username' ? (sortDir==='asc'?'▲':'▼') : ''}
            </th>
            <th className="sortable-header" onClick={() => toggleSort('email')}>
              Email {sortKey==='email' ? (sortDir==='asc'?'▲':'▼') : ''}
            </th>
            <th className="sortable-header" onClick={() => toggleSort('role')}>
              Role {sortKey==='role' ? (sortDir==='asc'?'▲':'▼') : ''}
            </th>
            <th>Profil</th>
            <th className="sortable-header" onClick={() => toggleSort('created_at')}>
              Vytvořeno {sortKey==='created_at' ? (sortDir==='asc'?'▲':'▼') : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="text-center py-4">Načítám uživatele...</td>
            </tr>
          ) : filteredAndSorted.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-muted">Žádní uživatelé k zobrazení</td>
            </tr>
          ) : filteredAndSorted.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <Badge bg={u.role === 'admin' ? 'danger' : 'primary'}>
                  {u.role}
                </Badge>
              </td>
              <td>
                {u.profile_approved ? (
                  <Badge bg="success">✅ Schváleno</Badge>
                ) : (
                  <Badge bg="warning">⚠️ Čeká</Badge>
                )}
              </td>
              <td className="d-flex justify-content-between align-items-center">
                <span>{formatDate(u.created_at)}</span>
                <span className="d-flex gap-2">
                  <Button size="sm" variant="info" onClick={() => openEditProfile(u)} title="Editovat profil">
                    📝 Profil
                  </Button>
                  <Button size="sm" variant="warning" onClick={() => openEdit(u)} title="Editovat účet">
                    ✏️ Účet
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteUser(u)} title="Smazat uživatele">
                    🗑️ Smazat
                  </Button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      
      <div className="text-muted mt-3">
        Celkem uživatelů: {users.length} | Zobrazeno: {filteredAndSorted.length}
      </div>

      <Modal show={!!mode} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {mode?.type === 'create' ? 'Nový uživatel' : mode?.type === 'edit_profile' ? 'Editovat profil' : 'Upravit uživatele'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {mode?.type === 'edit_profile' ? (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Rodné číslo</Form.Label>
                <Form.Control 
                  value={profileForm.birth_number} 
                  onChange={e => setProfileForm({ ...profileForm, birth_number: e.target.value })}
                  placeholder="Např. 8512121234"
                />
              </Form.Group>

              <h5 className="mt-4 mb-3">Adresa trvalého pobytu</h5>
              <Form.Group className="mb-3">
                <Form.Label>Ulice</Form.Label>
                <Form.Control 
                  value={profileForm.permanent_address} 
                  onChange={e => setProfileForm({ ...profileForm, permanent_address: e.target.value })}
                  placeholder="Ulice a číslo popisné"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Město</Form.Label>
                <Form.Control 
                  value={profileForm.permanent_city} 
                  onChange={e => setProfileForm({ ...profileForm, permanent_city: e.target.value })}
                  placeholder="Město"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>PSČ</Form.Label>
                <Form.Control 
                  value={profileForm.permanent_postal_code} 
                  onChange={e => setProfileForm({ ...profileForm, permanent_postal_code: e.target.value })}
                  placeholder="Poštovní směrovací číslo"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Země</Form.Label>
                <Form.Control 
                  value={profileForm.country} 
                  onChange={e => setProfileForm({ ...profileForm, country: e.target.value })}
                  placeholder="Česká republika"
                />
              </Form.Group>

              <h5 className="mt-4 mb-3">Korespondenční adresa</h5>
              <Form.Group className="mb-3">
                <Form.Label>Ulice</Form.Label>
                <Form.Control 
                  value={profileForm.address} 
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="Ulice a číslo popisné"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Město</Form.Label>
                <Form.Control 
                  value={profileForm.city} 
                  onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                  placeholder="Město"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>PSČ</Form.Label>
                <Form.Control 
                  value={profileForm.postal_code} 
                  onChange={e => setProfileForm({ ...profileForm, postal_code: e.target.value })}
                  placeholder="Poštovní směrovací číslo"
                />
              </Form.Group>

              <h5 className="mt-4 mb-3">Bankovní detaily</h5>
              <Form.Group className="mb-3">
                <Form.Label>Číslo účtu</Form.Label>
                <Form.Control 
                  value={profileForm.bank_account_number} 
                  onChange={e => setProfileForm({ ...profileForm, bank_account_number: e.target.value })}
                  placeholder="Číslo bankovního účtu"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Kód banky</Form.Label>
                <Form.Control 
                  value={profileForm.bank_code} 
                  onChange={e => setProfileForm({ ...profileForm, bank_code: e.target.value })}
                  placeholder="Např. 0100"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Název banky</Form.Label>
                <Form.Control 
                  value={profileForm.bank_name} 
                  onChange={e => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                  placeholder="Název banky"
                />
              </Form.Group>
            </Form>
          ) : (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Uživatelské jméno</Form.Label>
                <Form.Control value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Role</Form.Label>
                <Form.Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Heslo</Form.Label>
                <Form.Control type="password" placeholder={mode?.type==='edit' ? 'ponechat beze změny' : ''} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} />
                <Form.Text className="text-muted">Ponechte prázdné pro zachování stávajícího hesla.</Form.Text>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>❌ Zrušit</Button>
          <Button variant="primary" onClick={submitForm}>
            {mode?.type === 'create' ? '✅ Vytvořit' : '💾 Uložit změny'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminUsersManager;
