import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4777/api';

export interface PriceOffer {
  id: number;
  artwork_id: number;
  buyer_id: number;
  owner_id: number;
  offered_price: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  read_at?: string;
  created_at: string;
  artwork_title?: string;
  buyer_username?: string;
  buyer_email?: string;
}

export interface CreateOfferData {
  artworkId: number;
  offeredPrice: number;
  message?: string;
}

export const createOffer = async (data: CreateOfferData, token: string): Promise<PriceOffer> => {
  const response = await axios.post(`${API_URL}/offers`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getMyOffers = async (token: string): Promise<PriceOffer[]> => {
  const response = await axios.get(`${API_URL}/offers/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getUnreadOffersCount = async (token: string): Promise<number> => {
  const response = await axios.get(`${API_URL}/offers/unread-count`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.count;
};

export const markOfferAsRead = async (offerId: number, token: string): Promise<PriceOffer> => {
  const response = await axios.patch(`${API_URL}/offers/${offerId}/read`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const updateOfferStatus = async (
  offerId: number,
  status: 'accepted' | 'rejected',
  token: string
): Promise<PriceOffer> => {
  const response = await axios.patch(`${API_URL}/offers/${offerId}/status`, { status }, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
