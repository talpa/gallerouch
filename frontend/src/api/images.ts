import axios from 'axios';

const API_BASE = 'http://localhost:4777/api/artworks';

export interface ArtworkImage {
  id: number;
  artworkId: number;
  imageUrl: string;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const getArtworkImages = async (artworkId: number): Promise<ArtworkImage[]> => {
  const response = await axios.get<ArtworkImage[]>(`${API_BASE}/${artworkId}/images`);
  return response.data;
};

export const addArtworkImage = async (
  token: string,
  artworkId: number,
  imageUrl: string,
  isPrimary?: boolean
): Promise<ArtworkImage> => {
  const response = await axios.post(
    `${API_BASE}/${artworkId}/images`,
    { imageUrl, isPrimary },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const updateArtworkImage = async (
  token: string,
  artworkId: number,
  imageId: number,
  isPrimary?: boolean,
  displayOrder?: number
): Promise<ArtworkImage> => {
  const response = await axios.put(
    `${API_BASE}/${artworkId}/images/${imageId}`,
    { isPrimary, displayOrder },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const deleteArtworkImage = async (
  token: string,
  artworkId: number,
  imageId: number
): Promise<{ success: boolean }> => {
  const response = await axios.delete(
    `${API_BASE}/${artworkId}/images/${imageId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
