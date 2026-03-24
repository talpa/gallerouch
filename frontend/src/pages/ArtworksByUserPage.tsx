import React from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import ArtworksByUser from '../components/ArtworksByUser';

const ArtworksByUserPage: React.FC = () => {
  const { userType, userId } = useParams<{ userType: string; userId: string }>();
  
  if (!userType || !userId) {
    return (
      <PublicLayout>
        <div className="gallery-error">Chybí typ uživatele nebo ID</div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <ArtworksByUser userType={userType as 'author' | 'owner'} userId={parseInt(userId)} />
    </PublicLayout>
  );
};

export default ArtworksByUserPage;
