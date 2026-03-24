import axios, { AxiosError } from 'axios';

const API_BASE = 'http://localhost:4777/api/auth';

export interface Event {
  id: number;
  artwork_id: number;
  artwork_title: string;
  type: 'created' | 'updated' | 'price_change' | 'status_change' | 'deleted' | 'ownership_change';
  status: 'pending' | 'approved' | 'rejected';
  details: string;
  created_by: number;
  created_by_username: string;
  created_at: string;
  approved_by?: number;
  approved_by_username?: string;
  approved_at?: string;
  rejection_reason?: string;
  price?: number;
  owner_id?: number;
  owner_username?: string;
  owner_email?: string;
}

export interface ApprovalEvent {
  id: number;
  type: string;
  status: string;
  details?: string;
  createdAt: string;
  createdBy: number;
  creatorUsername: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectionReason?: string;
  approvedByUsername?: string;
  price?: number;
}

export interface EventsResponse {
  events: Event[];
  total: number;
}

export interface ArtworkApproval {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  status: string;
  userId: number;
  creatorUsername: string;
  events: ApprovalEvent[];
}

export interface ArtworkApprovalsResponse {
  artworks: ArtworkApproval[];
  total: number;
}

export const getEvents = async (
  token: string,
  status: string = 'pending',
  limit: number = 50,
  offset: number = 0
): Promise<EventsResponse> => {
  try {
    const response = await axios.get(`${API_BASE}/events`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { status, limit, offset }
    });
    return response.data;
  } catch (error) {
    throw (error as AxiosError).response?.data || error;
  }
};

export const approveEvent = async (
  token: string,
  eventId: number,
  notes?: string
): Promise<Event> => {
  try {
    const response = await axios.post(
      `${API_BASE}/events/${eventId}/approve`,
      { notes },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    throw (error as AxiosError).response?.data || error;
  }
};

export const rejectEvent = async (
  token: string,
  eventId: number,
  reason?: string
): Promise<Event> => {
  try {
    const response = await axios.post(
      `${API_BASE}/events/${eventId}/reject`,
      { reason },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    throw (error as AxiosError).response?.data || error;
  }
};

export const getArtworkApprovals = async (
  token: string,
  approved: string = 'all',
  limit: number = 100,
  offset: number = 0
): Promise<ArtworkApprovalsResponse> => {
  try {
    const response = await axios.get(`${API_BASE}/admin/artwork-approvals`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { approved, limit, offset }
    });
    return response.data;
  } catch (error) {
    throw (error as AxiosError).response?.data || error;
  }
};
