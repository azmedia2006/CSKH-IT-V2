import { api } from './api';
import { Ticket, DashboardStats } from '../types/ticket';

export const ticketApi = {
  getTickets: async (skip = 0, limit = 100): Promise<Ticket[]> => {
    const response = await api.get('/tickets/', { params: { skip, limit } });
    return response.data;
  },
  
  getTicket: async (id: string): Promise<Ticket> => {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  },

  createTicket: async (data: Partial<Ticket>): Promise<Ticket> => {
    const response = await api.post('/tickets/', data);
    return response.data;
  },

  updateTicket: async (id: string, data: Partial<Ticket>): Promise<Ticket> => {
    const response = await api.put(`/tickets/${id}`, data);
    return response.data;
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getKpi: async () => {
    const response = await api.get('/reports/kpi');
    return response.data;
  },

  getChartData: async () => {
    const response = await api.get('/reports/chart-data');
    return response.data;
  },

  classifyTicket: async (id: string, description: string) => {
    const response = await api.post(`/tickets/${id}/classify`, { description });
    return response.data;
  },

  suggestReply: async (id: string, ticket_context: string) => {
    const response = await api.post(`/tickets/${id}/suggest-reply`, { ticket_context });
    return response.data;
  },

  summarizeHistory: async (id: string, comments: string[]) => {
    const response = await api.post(`/tickets/${id}/summarize`, { comments });
    return response.data;
  },

  getComments: async (id: string) => {
    const response = await api.get(`/tickets/${id}/comments`);
    return response.data;
  },

  addComment: async (
    id: string,
    content: string,
    is_internal = false,
    is_ai_generated = false,
    edited_by_agent = false
  ) => {
    const response = await api.post(`/tickets/${id}/comments`, {
      content,
      is_internal,
      is_ai_generated,
      edited_by_agent
    });
    return response.data;
  },

  getAttachments: async (id: string) => {
    const response = await api.get(`/tickets/${id}/attachments`);
    return response.data;
  },

  uploadAttachment: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/tickets/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  fetchAttachmentBlob: async (ticketId: string, attachmentId: string): Promise<Blob> => {
    const response = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}/file`, {
      responseType: 'blob',
    });
    return response.data;
  },

  exportReport: async () => {
    const response = await api.get('/reports/export', {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteTicket: async (id: string) => {
    const response = await api.delete(`/tickets/${id}`);
    return response.data;
  },

  getPublicRecentTickets: async () => {
    const response = await api.get('/tickets/public-recent');
    return response.data;
  },

  getAiActivities: async () => {
    const response = await api.get('/dashboard/ai-activities');
    return response.data;
  }
};
