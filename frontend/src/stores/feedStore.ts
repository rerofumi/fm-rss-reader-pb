import { create } from 'zustand';
import { mcpService } from '@/services/mcpService';
import type { Feed } from '@/types';

interface FeedState {
  feedsByGenre: Record<string, Feed[]>;
  loading: boolean;
  fetchFeeds: (genreId: string) => Promise<void>;
  addFeed: (genreId: string, url: string) => Promise<void>;
  removeFeed: (feedId: string, genreId: string) => Promise<void>;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  feedsByGenre: {},
  loading: false,

  fetchFeeds: async (genreId: string) => {
    set({ loading: true });
    try {
      const feeds = await mcpService.feeds.list(genreId);
      set(state => ({
        feedsByGenre: { ...state.feedsByGenre, [genreId]: feeds },
        loading: false
      }));
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  addFeed: async (genreId: string, url: string) => {
    try {
      const feed = await mcpService.feeds.add(genreId, url);
      set(state => ({
        feedsByGenre: {
          ...state.feedsByGenre,
          [genreId]: [...(state.feedsByGenre[genreId] || []), feed]
        }
      }));
    } catch (error) {
      throw error;
    }
  },

  removeFeed: async (feedId: string, genreId: string) => {
    try {
      await mcpService.feeds.remove(feedId);
      set(state => ({
        feedsByGenre: {
          ...state.feedsByGenre,
          [genreId]: (state.feedsByGenre[genreId] || []).filter(f => f.id !== feedId)
        }
      }));
    } catch (error) {
      throw error;
    }
  },
}));