import axios from 'axios';
import { normalizeArrayPayload } from '../utils/apiPayload';

const API_BASE = '/api/auth';

export interface Setting {
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsResponse {
  settings: Setting[];
}

export const getSettings = async (token: string): Promise<SettingsResponse> => {
  const response = await axios.get(`${API_BASE}/settings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = response.data as any;

  if (Array.isArray(payload)) {
    return { settings: payload };
  }

  return {
    settings: normalizeArrayPayload<Setting>(payload, ['settings']),
  };
};

export const getSetting = async (token: string, key: string): Promise<Setting> => {
  const response = await axios.get(`${API_BASE}/settings/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const updateSetting = async (
  token: string,
  key: string,
  value: string,
  description?: string
): Promise<{ message: string; setting: Setting }> => {
  const response = await axios.put(
    `${API_BASE}/settings/${key}`,
    { value, description },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const createSetting = async (
  token: string,
  key: string,
  value: string,
  description?: string
): Promise<{ message: string; setting: Setting }> => {
  const response = await axios.post(
    `${API_BASE}/settings`,
    { key, value, description },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const deleteSetting = async (
  token: string,
  key: string
): Promise<{ message: string; setting: Setting }> => {
  const response = await axios.delete(`${API_BASE}/settings/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
