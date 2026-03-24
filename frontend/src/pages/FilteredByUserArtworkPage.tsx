import React from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import UserFilteredArtworkList from '../components/UserFilteredArtworkList';

const FilteredByUserArtworkPage: React.FC = () => {
  const { userId, filterType } = useParams<{ userId: string; filterType: string }>();
  
  if (!userId || !filterType || (filterType !== 'author' && filterType !== 'owner')) {
    return (
      <PublicLayout>
        <div className="gallery-error">Chybí parametry</div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <UserFilteredArtworkList 
        userId={parseInt(userId)} 
        filterType={filterType as 'author' | 'owner'} 
      />
    </PublicLayout>
  );
};

export default FilteredByUserArtworkPage;
