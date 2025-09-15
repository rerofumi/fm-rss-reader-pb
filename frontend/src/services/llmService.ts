import type { LlmQueryRequest, LlmQueryResponse } from '@/types';
import { authService } from './authService';

const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';

export const llmService = {
  getCurrentModel(): string {
    const savedModel = localStorage.getItem('llm_model');
    return savedModel || DEFAULT_MODEL;
  },

  async query(request: LlmQueryRequest): Promise<LlmQueryResponse> {
    const model = this.getCurrentModel();
    const requestWithModel = {
      ...request,
      model: model,
    };

    const response = await fetch(`/api/llm/query`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify(requestWithModel),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'LLM query failed');
    }

    return response.json();
  },

  async getModels(): Promise<string[]> {
    const response = await fetch(`/api/llm/models`, {
      method: 'GET',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.models || [];
  },
};
