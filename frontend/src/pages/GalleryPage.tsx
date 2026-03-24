
import React from 'react';
import PublicLayout from '../components/PublicLayout';
import ArtworkList from '../components/ArtworkList';

const GalleryPage: React.FC = () => {
  return (
    <PublicLayout>
      <ArtworkList />
    </PublicLayout>
  );
};

export default GalleryPage;
