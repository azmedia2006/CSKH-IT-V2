import { api } from './api';

export interface Article {
  id: number | string;
  category: string;
  categoryLabel: string;
  title: string;
  desc: string;
  views: string;
  time: string;
  badge?: string;
  content: string;
  steps: string[];
  isCustom?: boolean;
}

export interface FAQItem {
  id: string;
  category: string;
  categoryLabel: string;
  question: string;
  answer: string;
  detailedSteps: string[];
  tips: string[];
  views: number;
  initialLikes: number;
  initialDislikes: number;
  updatedAt: string;
  tags: string[];
  priorityLevel: string;
}

export const knowledgeApi = {
  getArticles: async (): Promise<Article[]> => {
    const response = await api.get('/knowledge/articles');
    return response.data;
  },

  getArticleDetail: async (id: number | string): Promise<Article> => {
    const response = await api.get(`/knowledge/articles/${id}`);
    return response.data;
  },

  getFaqs: async (): Promise<FAQItem[]> => {
    const response = await api.get('/knowledge/faqs');
    return response.data;
  },

  recordView: async (id: number | string): Promise<{ views: number; views_text: string }> => {
    const response = await api.post(`/knowledge/articles/${id}/view`);
    return response.data;
  },

  submitFeedback: async (id: number | string, helpful: boolean): Promise<{ helpful: number; not_helpful: number; message: string }> => {
    const response = await api.post(`/knowledge/articles/${id}/feedback`, { helpful });
    return response.data;
  },

  getStats: async (): Promise<Record<string, { views: number; helpful: number; not_helpful: number }>> => {
    const response = await api.get('/knowledge/articles/stats/all');
    return response.data;
  }
};

export const notificationApi = {
  getNotifications: async (): Promise<Array<{ id: string; ticket_id?: string; title: string; desc: string; time: string; type: string; link?: string }>> => {
    const response = await api.get('/tickets/notifications/list');
    return response.data;
  }
};
export const faqSyncApi = {
  getAllFaqs: async (): Promise<{ approved: FAQItem[]; pending: FAQItem[] }> => {
    const response = await api.get('/knowledge/faqs/all');
    return response.data;
  },

  submitQuestion: async (data: { category: string; question: string; details?: string }) => {
    const response = await api.post('/knowledge/faqs/submit', data);
    return response.data;
  },

  approveQuestion: async (faqId: string) => {
    const response = await api.post('/knowledge/faqs/approve', { faq_id: faqId });
    return response.data;
  },

  rejectQuestion: async (faqId: string) => {
    const response = await api.post('/knowledge/faqs/reject', { faq_id: faqId });
    return response.data;
  }
};

export const faqDeleteApi = {
  deleteFaq: async (faqId: string) => {
    const response = await api.delete(`/knowledge/faqs/${faqId}`);
    return response.data;
  },

  updateFaq: async (faqId: string, data: { category?: string; question?: string; answer?: string; priorityLevel?: string }) => {
    const response = await api.put(`/knowledge/faqs/${faqId}`, data);
    return response.data;
  }
};
