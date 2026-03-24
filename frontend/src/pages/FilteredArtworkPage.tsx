import React from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import FilteredArtworkList from '../components/FilteredArtworkList';

const FilteredArtworkPage: React.FC = () => {
  const { status } = useParams<{ status: string }>();
  
  if (!status) {
    return (
      <PublicLayout>
        <div className="gallery-error">Chybí status</div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <FilteredArtworkList initialStatus={status} />
    </PublicLayout>
  );
};

export default FilteredArtworkPage;
