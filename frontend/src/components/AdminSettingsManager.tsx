import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../store';
import { getSettings, updateSetting, createSetting, deleteSetting, Setting } from '../api/settings';
import { Table, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import './AdminSettingsManager.css';

const AdminSettingsManager: React.FC = () => {
  const { t } = useTranslation();
  const token = useSelector((state: RootState) => state.auth.token);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    show: boolean;
    setting: Setting | null;
  }>({
    show: false,
    setting: null
  });
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    description: ''
  });

  useEffect(() => {
    loadSettings();
  }, [token]);

  const loadSettings = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getSettings(token);
      setSettings(data.settings);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při načítání nastavení');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: Setting) => {
    setFormData({
      key: setting.key,
      value: setting.value,
      description: setting.description || ''
    });
    setEditModal({ show: true, setting });
  };

  const handleCreate = () => {
    setFormData({ key: '', value: '', description: '' });
    setCreateModal(true);
  };

  const handleSave = async () => {
    if (!token) return;
    
    try {
      if (editModal.setting) {
        // Update existing setting
        await updateSetting(token, editModal.setting.key, formData.value, formData.description);
        setSuccess('Nastavení úspěšně aktualizováno');
      } else {
        // Create new setting
        await createSetting(token, formData.key, formData.value, formData.description);
        setSuccess('Nastavení úspěšně vytvořeno');
      }
      
      setEditModal({ show: false, setting: null });
      setCreateModal(false);
      await loadSettings();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při ukládání nastavení');
    }
  };

  const handleDelete = async (key: string) => {
    if (!token) return;
    if (!window.confirm('Opravdu chcete smazat toto nastavení?')) return;
    
    try {
      await deleteSetting(token, key);
      setSuccess('Nastavení úspěšně smazáno');
      await loadSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Chyba při mazání nastavení');
    }
  };

  const closeModal = () => {
    setEditModal({ show: false, setting: null });
    setCreateModal(false);
    setFormData({ key: '', value: '', description: '' });
  };

  return (
    <div className="admin-settings-manager">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('settings.title') || 'Nastavení aplikace'}</h2>
        <Button variant="success" size="sm" onClick={handleCreate}>
          ➕ {t('settings.createNew') || 'Vytvořit nastavení'}
        </Button>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

      {loading && (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">{t('common.loading') || 'Načítání...'}</span>
          </Spinner>
        </div>
      )}

      {!loading && settings.length === 0 && (
        <Alert variant="info">{t('settings.noSettings') || 'Žádná nastavení'}</Alert>
      )}

      {!loading && settings.length > 0 && (
        <div className="settings-table">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>{t('settings.key') || 'Klíč'}</th>
                <th>{t('settings.value') || 'Hodnota'}</th>
                <th>{t('settings.description') || 'Popis'}</th>
                <th>{t('settings.updatedAt') || 'Aktualizováno'}</th>
                <th>{t('settings.actions') || 'Akce'}</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.key}>
                  <td><code>{setting.key}</code></td>
                  <td>{setting.value}</td>
                  <td>{setting.description || '-'}</td>
                  <td>{new Date(setting.updated_at).toLocaleString('cs-CZ')}</td>
                  <td>
                    <div className="action-buttons">
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => handleEdit(setting)}
                        title={t('common.edit')}
                      >
                        ✏️ {t('common.edit')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(setting.key)}
                        title={t('common.delete')}
                      >
                        🗑️ {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal show={editModal.show} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>{t('settings.editSetting') || 'Upravit nastavení'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.key') || 'Klíč'}</Form.Label>
              <Form.Control
                type="text"
                value={formData.key}
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.value') || 'Hodnota'}</Form.Label>
              <Form.Control
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.description') || 'Popis'}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            {t('common.cancel') || 'Zrušit'}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t('common.save') || 'Uložit'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Modal */}
      <Modal show={createModal} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>{t('settings.createSetting') || 'Vytvořit nastavení'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.key') || 'Klíč'}</Form.Label>
              <Form.Control
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="např. gallery_bank_account"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.value') || 'Hodnota'}</Form.Label>
              <Form.Control
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('settings.description') || 'Popis'}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            {t('common.cancel') || 'Zrušit'}
          </Button>
          <Button variant="success" onClick={handleSave}>
            {t('common.create') || 'Vytvořit'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminSettingsManager;
