import type { Genre, Feed, Article } from '@/types';
import { authService } from './authService';
import { buildApiUrl } from './apiUrl';

const MCP_ENDPOINT = `/mcp/rss`;

async function callMcp(name: string, args: Record<string, unknown> = {}) {
  const response = await fetch(buildApiUrl(MCP_ENDPOINT), {
    method: 'POST',
    headers: authService.getAuthHeaders(),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP call failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'MCP error');
  }

  // result.content[0].text を JSON.parse
  const textContent = data.result?.content?.[0]?.text;
  if (!textContent) {
    throw new Error('Invalid MCP response format');
  }

  return JSON.parse(textContent);
}

export const mcpService = {
  genres: {
    async list(): Promise<Genre[]> {
      const result = await callMcp('genre.list');
      return result.genres || [];
    },

    async create(name: string): Promise<Genre> {
      const result = await callMcp('genre.create', { name });
      return result.genre;
    },

    async update(id: string, name: string): Promise<Genre> {
      const result = await callMcp('genre.update', { id, name });
      return result.genre;
    },

    async delete(id: string): Promise<void> {
      await callMcp('genre.delete', { id });
    },
  },

  feeds: {
    async list(genreId: string): Promise<Feed[]> {
      const result = await callMcp('feed.list', { genreId });
      return result.feeds || [];
    },

    async add(genreId: string, url: string): Promise<Feed> {
      const result = await callMcp('feed.add', { genreId, url });
      return result.feed;
    },

    async remove(id: string): Promise<void> {
      await callMcp('feed.remove', { id });
    },
  },

  articles: {
    async fetchByGenre(genreId: string, limit: number = 50): Promise<Article[]> {
      const result = await callMcp('articles.fetchByGenre', { genreId, limit });
      return result.articles || [];
    },

    async fetchByUrl(url: string, limit: number = 50): Promise<Article[]> {
      const result = await callMcp('articles.fetchByUrl', { url, limit });
      return result.articles || [];
    },
  },
};
