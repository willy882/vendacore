import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  refreshToken: string | null;

  setAuth:    (user: User, access: string, refresh: string) => void;
  setTokens:  (access: string, refresh: string) => void;
  logout:     () => void;
  isLoggedIn: () => boolean;
  hasRole:    (role: string) => boolean;
  hasRoles:   (roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      isLoggedIn: () => !!get().accessToken && !!get().user,

      hasRole: (role) => get().user?.role?.name === role,

      hasRoles: (roles) => roles.includes(get().user?.role?.name ?? ''),
    }),
    {
      name: 'vendacore-auth',
      partialize: (s) => ({
        user:         s.user,
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
