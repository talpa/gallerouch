import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PublicLayout from '../components/PublicLayout';
import axios from 'axios';

interface User {
  id: number;
  name: string;
  email: string;
  count: number;
}

const UsersGalleryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { filterType } = useParams<{ filterType: 'author' | 'owner' }>();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isAuthor = filterType === 'author';
  const pageTitle = isAuthor ? t('gallery.authors') : t('gallery.owners');

  const normalizeArrayPayload = <T,>(payload: any): T[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.rows)) return payload.rows;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.users)) return payload.users;
    return [];
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const endpoint = isAuthor 
          ? '/api/artworks/authors' 
          : '/api/artworks/owners';
        const res = await axios.get(endpoint);
        setUsers(normalizeArrayPayload(res.data));
      } catch (err: any) {
        setError(err?.message || t('messages.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filterType, isAuthor, t]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <PublicLayout><div className="gallery-loading">{t('common.loading')}</div></PublicLayout>;
  if (error) return <PublicLayout><div className="gallery-error">{t('common.error')}: {error}</div></PublicLayout>;

  return (
    <PublicLayout>
      <div className="users-gallery-container">
        <div className="users-gallery-header">
          <h1>{pageTitle}</h1>
          <p className="text-muted">
            {t('gallery.displayed')}: <strong>{filteredUsers.length}</strong> {t('gallery.of')} <strong>{users.length}</strong>
          </p>
        </div>

        <div className="users-gallery-search">
          <input
            type="text"
            className="gallery-search"
            placeholder={t('gallery.search') || 'Hledat...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredUsers.length === 0 ? (
          <div className="gallery-empty">{t('gallery.notFound')}</div>
        ) : (
          <div className="users-grid">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                className="user-card"
                onClick={() => navigate(`/gallery/${filterType}/${user.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <h3 className="user-name">{user.name}</h3>
                  <p className="user-email">{user.email}</p>
                  <div className="user-artwork-count">
                    <strong>{user.count}</strong> {user.count === 1 ? 'dílo' : 'děl'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default UsersGalleryPage;
