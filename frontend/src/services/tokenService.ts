import type { McpToken } from '@/types';
import { authService } from './authService';

export const tokenService = {
  async list(): Promise<McpToken[]> {
    const response = await fetch(`/api/mcp/tokens`, {
      method: 'GET',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tokens');
    }

    const data = await response.json();
    return data.items || [];
  },

  async create(params: {
    name?: string;
    scopes?: string[];
    expiresAt?: string;
  }): Promise<{ token: string; id: string; expiresAt?: string }> {
    const response = await fetch(`/api/mcp/tokens`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create token');
    }

    return response.json();
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/mcp/tokens/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete token');
    }
  },
};
