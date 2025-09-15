import { create } from 'zustand';
import { mcpService } from '@/services/mcpService';
import type { Article } from '@/types';

interface ArticleState {
  articlesByGenre: Record<string, Article[]>;
  loadingByGenre: Record<string, boolean>;
  fetchArticles: (genreId: string, limit?: number) => Promise<void>;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  articlesByGenre: {},
  loadingByGenre: {},

  fetchArticles: async (genreId: string, limit: number = 50) => {
    set(state => ({
      loadingByGenre: { ...state.loadingByGenre, [genreId]: true }
    }));

    try {
      const articles = await mcpService.articles.fetchByGenre(genreId, limit);
      set(state => ({
        articlesByGenre: { ...state.articlesByGenre, [genreId]: articles },
        loadingByGenre: { ...state.loadingByGenre, [genreId]: false }
      }));
    } catch (error) {
      set(state => ({
        loadingByGenre: { ...state.loadingByGenre, [genreId]: false }
      }));
      throw error;
    }
  },
}));