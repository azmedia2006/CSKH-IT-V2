import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: null, // Should ideally be parsed from token or fetched on app load
  isAuthenticated: !!localStorage.getItem('token'),
  
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));

// Listen for global unauthorized events from axios
window.addEventListener('auth:unauthorized', () => {
  useAuthStore.getState().logout();
});
