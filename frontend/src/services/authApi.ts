import { api } from './api';

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/auth/login', {
      email: credentials.email,
      password: credentials.password
    });
    return response.data;
  },

  register: async (userData: { email: string; password: string; full_name?: string }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  forgotPassword: async (data: { email: string }) => {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },

  verifyOtp: async (data: { email: string; otp: string }): Promise<{ valid: boolean; message: string; reset_token?: string; masked_email: string }> => {
    const response = await api.post('/auth/verify-otp', data);
    return response.data;
  },

  resetPassword: async (data: { email?: string; otp?: string; reset_token?: string; new_password: string }) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
  
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token'); localStorage.removeItem('user_role');
      window.location.href = '/login';
    }
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  updateProfile: async (data: { full_name?: string; department?: string; phone_number?: string; current_password?: string; new_password?: string }) => {
    const response = await api.put('/users/me', data);
    return response.data;
  }
};