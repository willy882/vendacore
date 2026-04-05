import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

// build:2026-04-05
const PROD_URL = 'https://backend-production-65fc.up.railway.app/api/v1';
const BASE_URL = import.meta.env.DEV ? '/api/v1' : PROD_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: adjunta el access token ────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: refresca token en 401 y reintenta ──────────────────────────────
let refreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (refreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        original.headers!.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    refreshing = true;
    const store = useAuthStore.getState();

    try {
      const refreshURL = import.meta.env.DEV ? '/api/v1/auth/refresh' : `${BASE_URL}/auth/refresh`;
      const { data } = await axios.post(refreshURL, {
        refreshToken: store.refreshToken,
      });
      const newToken: string = data.accessToken;
      store.setTokens(newToken, data.refreshToken ?? store.refreshToken!);
      queue.forEach((p) => p.resolve(newToken));
      queue = [];
      original.headers!.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (e) {
      queue.forEach((p) => p.reject(e));
      queue = [];
      store.logout();
      return Promise.reject(e);
    } finally {
      refreshing = false;
    }
  },
);

export default api;
