import { create } from 'zustand';
import { authService } from '@/services/authService';
import type { User } from '@/types';

interface AuthState {
  isAuthed: boolean;
  loading: boolean;
  user?: User;
  login: (identity: string, password: string) => Promise<void>;
  checkSession: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthed: false,
  loading: true,
  user: undefined,

  login: async (identity: string, password: string) => {
    set({ loading: true });
    try {
      const result = await authService.login(identity, password);
      set({
        isAuthed: true,
        loading: false,
        user: { 
          id: result.record?.id || 'user', 
          email: result.record?.email || result.record?.username 
        },
      });
    } catch (error) {
      set({ loading: false, isAuthed: false });
      throw error;
    }
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const isValid = await authService.checkSession();
      if (isValid) {
        // JWT トークンが有効な場合
        const token = localStorage.getItem('pb_jwt');
        if (token) {
          // JWT をデコードしてユーザー情報を取得
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            set({
              isAuthed: true,
              loading: false,
              user: { 
                id: payload.id || 'user', 
                email: payload.email || payload.username || 'user@example.com'
              },
            });
          } catch {
            // JWT デコードに失敗した場合はデフォルト値を使用
            set({
              isAuthed: true,
              loading: false,
              user: { id: 'user', email: 'user@example.com' },
            });
          }
        } else {
          set({ isAuthed: false, loading: false, user: undefined });
        }
      } else {
        set({ isAuthed: false, loading: false, user: undefined });
      }
    } catch (error) {
      set({ isAuthed: false, loading: false, user: undefined });
    }
  },

  logout: () => {
    set({ isAuthed: false, user: undefined, loading: false });
    authService.logout();
  },
}));