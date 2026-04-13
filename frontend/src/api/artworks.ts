import axios from 'axios';
import { Artwork, ArtworkStatus } from '../components/ArtworkList';

export interface ArtworkEvent {
  id: string;
  artworkName: string;
  type: string;
  date: string;
  userName: string;
}

export async function fetchArtworks(): Promise<Artwork[]> {
  const res = await axios.get<Artwork[]>('/api/artworks/approved');
  const data = res.data as any;

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.artworks)) {
    return data.artworks;
  }

  if (data && Array.isArray(data.rows)) {
    return data.rows;
  }

  console.warn('Unexpected /api/artworks/approved response shape:', data);
  return [];
}

export async function fetchArtworkEvents(): Promise<ArtworkEvent[]> {
  const res = await axios.get<any[]>('/api/artwork-events');
  // Map backend response to the unified ArtworkEvent shape
  return res.data.map(ev => {
    // Ensure date is a valid ISO string
    let validDate = ev.date ?? ev.eventDate ?? new Date().toISOString();
    
    // If date is a string but not ISO format, try to parse and convert
    if (typeof validDate === 'string') {
      const parsed = new Date(validDate);
      if (!isNaN(parsed.getTime())) {
        validDate = parsed.toISOString();
      } else {
        validDate = new Date().toISOString();
      }
    }
    
    return {
      id: ev.id ?? ev.artworkId ?? '',
      artworkName: ev.artworkName ?? ev.title ?? '',
      type: ev.type ?? ev.status ?? '',
      date: validDate,
      userName: ev.userName ?? ev.user ?? '',
    };
  });
}
