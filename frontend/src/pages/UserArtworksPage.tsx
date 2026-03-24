import React from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import UserFilteredArtworkList from '../components/UserFilteredArtworkList';

const UserArtworksPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { filterType } = useParams<{ filterType: string }>();
  
  if (!userId) {
    return (
      <PublicLayout>
        <div className="gallery-error">Chybí ID uživatele</div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <UserFilteredArtworkList userId={parseInt(userId)} filterType={(filterType as 'author' | 'owner') || 'owner'} />
    </PublicLayout>
  );
};

export default UserArtworksPage;
