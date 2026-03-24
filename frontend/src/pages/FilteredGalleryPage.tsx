import React from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import FilteredArtworkList from '../components/FilteredArtworkList';

const FilteredGalleryPage: React.FC = () => {
  const { status } = useParams<{ status: string }>();

  return (
    <PublicLayout>
      <FilteredArtworkList initialStatus={status || 'k_prodeji'} />
    </PublicLayout>
  );
};

export default FilteredGalleryPage;
