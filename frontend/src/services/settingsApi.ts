import { api } from './api';

export interface GeminiKeyInfo {
  id: string;
  name: string;
  masked_key: string;
  is_active: boolean;
  status: 'ACTIVE' | 'RATE_LIMITED' | 'INVALID' | 'DISABLED';
  total_requests: number;
  failed_requests: number;
  last_used_at: number | null;
  last_error: string | null;
  rate_limited_until: number;
  remaining_cooldown?: number;
  created_at: number;
}

export interface KeyPoolStats {
  total_keys: number;
  active_keys: number;
  rate_limited_keys: number;
  error_keys: number;
  current_index: number;
}

export interface AISettingsResponse {
  provider: 'google' | 'groq' | 'cohere' | 'auto';
  model_name: string;
  groq_model_name?: string;
  cohere_model_name?: string;
  rotation_strategy: 'FAILOVER' | 'ROUND_ROBIN';
  cooldown_seconds: number;
  timeout_seconds: number;
  confidence_threshold: number;
  auto_triage: boolean;
  mask_pii: boolean;
  sla_p1_response: number;
  sla_p1_resolve: number;
  email_alerts: boolean;
  keys: GeminiKeyInfo[];
  groq_keys?: GeminiKeyInfo[];
  cohere_keys?: GeminiKeyInfo[];
  stats: KeyPoolStats;
  groq_stats?: KeyPoolStats;
  cohere_stats?: KeyPoolStats;
}

export interface KeyTestResult {
  success: boolean;
  status_code: number;
  latency_ms: number;
  message: string;
  model?: string;
  error_type?: string;
}

export interface RotationLog {
  timestamp: number;
  key_id: string;
  key_name: string;
  event: string;
  message: string;
  error?: string;
}

export interface PromptTestResult {
  success: boolean;
  provider?: string;
  model?: string;
  latency_ms: number;
  response?: string;
  error?: string;
  stats?: KeyPoolStats;
}

export const settingsApi = {
  getAISettings: async (): Promise<AISettingsResponse> => {
    const response = await api.get('/settings/ai');
    return response.data;
  },

  updateAISettings: async (data: Partial<AISettingsResponse>): Promise<AISettingsResponse> => {
    const response = await api.put('/settings/ai', data);
    return response.data;
  },

  // --- Gemini API Keys ---
  addKey: async (key: string, name?: string): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/keys', { key, name });
    return response.data;
  },

  addBatchKeys: async (raw_keys: string): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/keys/batch', { raw_keys });
    return response.data;
  },

  updateKey: async (
    keyId: string,
    updates: { name?: string; is_active?: boolean; status?: string }
  ): Promise<AISettingsResponse> => {
    const response = await api.put(`/settings/ai/keys/${keyId}`, updates);
    return response.data;
  },

  deleteKey: async (keyId: string): Promise<AISettingsResponse> => {
    const response = await api.delete(`/settings/ai/keys/${keyId}`);
    return response.data;
  },

  testKey: async (keyId: string): Promise<KeyTestResult> => {
    const response = await api.post(`/settings/ai/keys/${keyId}/test`);
    return response.data;
  },

  testUnsavedKey: async (key: string, model_name = 'gemini-flash-latest'): Promise<KeyTestResult> => {
    const response = await api.post('/settings/ai/test-key', { key, model_name });
    return response.data;
  },

  resetKeysStatus: async (): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/keys/reset-status');
    return response.data;
  },

  // --- Groq API Keys ---
  addGroqKey: async (key: string, name?: string): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/groq/keys', { key, name });
    return response.data;
  },

  addBatchGroqKeys: async (raw_keys: string): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/groq/keys/batch', { raw_keys });
    return response.data;
  },

  updateGroqKey: async (
    keyId: string,
    updates: { name?: string; is_active?: boolean; status?: string }
  ): Promise<AISettingsResponse> => {
    const response = await api.put(`/settings/ai/groq/keys/${keyId}`, updates);
    return response.data;
  },

  deleteGroqKey: async (keyId: string): Promise<AISettingsResponse> => {
    const response = await api.delete(`/settings/ai/groq/keys/${keyId}`);
    return response.data;
  },

  testGroqKey: async (keyId: string): Promise<KeyTestResult> => {
    const response = await api.post(`/settings/ai/groq/keys/${keyId}/test`);
    return response.data;
  },

  testUnsavedGroqKey: async (key: string, model_name = 'openai/gpt-oss-120b'): Promise<KeyTestResult> => {
    const response = await api.post('/settings/ai/groq/test-key', { key, model_name });
    return response.data;
  },

  resetGroqKeysStatus: async (): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/groq/keys/reset-status');
    return response.data;
  },

  // --- Cohere API Keys ---
  addCohereKey: async (key: string, name?: string): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/cohere/keys', { key, name });
    return response.data;
  },

  addBatchCohereKeys: async (raw_keys: string): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/cohere/keys/batch', { raw_keys });
    return response.data;
  },

  updateCohereKey: async (
    keyId: string,
    updates: { name?: string; is_active?: boolean; status?: string }
  ): Promise<AISettingsResponse> => {
    const response = await api.put(`/settings/ai/cohere/keys/${keyId}`, updates);
    return response.data;
  },

  deleteCohereKey: async (keyId: string): Promise<AISettingsResponse> => {
    const response = await api.delete(`/settings/ai/cohere/keys/${keyId}`);
    return response.data;
  },

  testCohereKey: async (keyId: string): Promise<KeyTestResult> => {
    const response = await api.post(`/settings/ai/cohere/keys/${keyId}/test`);
    return response.data;
  },

  testUnsavedCohereKey: async (key: string, model_name = 'command-r-plus'): Promise<KeyTestResult> => {
    const response = await api.post('/settings/ai/cohere/test-key', { key, model_name });
    return response.data;
  },

  resetCohereKeysStatus: async (): Promise<AISettingsResponse> => {
    const response = await api.post('/settings/ai/cohere/keys/reset-status');
    return response.data;
  },

  // --- Logs & Playground ---
  getRotationLogs: async (): Promise<RotationLog[]> => {
    const response = await api.get('/settings/ai/rotation-logs');
    return response.data;
  },

  testPrompt: async (
    prompt: string,
    system_instruction?: string,
    temperature = 0.2
  ): Promise<PromptTestResult> => {
    const response = await api.post('/settings/ai/prompt-test', {
      prompt,
      system_instruction,
      temperature,
    });
    return response.data;
  },

  // --- SLA Policies ---
  getSLAPolicies: async (): Promise<SLAPolicyItem[]> => {
    const response = await api.get('/settings/sla-policies');
    return response.data;
  },

  updateSLAPolicies: async (policies: SLAPolicyItem[]) => {
    const response = await api.put('/settings/sla-policies', { policies });
    return response.data;
  },

  // --- Categories Management ---
  getCategories: async (): Promise<CategoryItem[]> => {
    const response = await api.get('/settings/categories');
    return response.data;
  },

  createCategory: async (data: Partial<CategoryItem>): Promise<CategoryItem> => {
    const response = await api.post('/settings/categories', data);
    return response.data;
  },

  updateCategory: async (id: string, data: Partial<CategoryItem>): Promise<CategoryItem> => {
    const response = await api.put(`/settings/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete(`/settings/categories/${id}`);
    return response.data;
  },
};

export interface SLAPolicyItem {
  id?: string;
  priority_level: string;
  response_time_minutes: number;
  resolve_time_minutes: number;
  description?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

export interface GoogleAuthSettings {
  enabled: boolean;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export const googleAuthApi = {
  getSettings: async (): Promise<GoogleAuthSettings> => {
    const res = await api.get('/settings/google');
    return res.data;
  },
  updateSettings: async (data: Partial<GoogleAuthSettings>): Promise<GoogleAuthSettings> => {
    const res = await api.put('/settings/google', data);
    return res.data;
  },
  getPublicConfig: async (): Promise<{ enabled: boolean; client_id: string; redirect_uri: string }> => {
    const res = await api.get('/auth/google-config');
    return res.data;
  },
  loginWithGoogle: async (payload: { credential?: string; access_token?: string; is_register?: boolean }): Promise<{ access_token: string; token_type: string }> => {
    const res = await api.post('/auth/google', payload);
    return res.data;
  }
};
