import { create } from 'zustand';
import { mcpService } from '@/services/mcpService';
import type { Genre } from '@/types';

interface GenreState {
  genres: Genre[];
  activeGenreId?: string;
  loading: boolean;
  fetchGenres: () => Promise<void>;
  createGenre: (name: string) => Promise<void>;
  updateGenre: (id: string, name: string) => Promise<void>;
  deleteGenre: (id: string) => Promise<void>;
  setActiveGenre: (id: string) => void;
}

export const useGenreStore = create<GenreState>((set, get) => ({
  genres: [],
  activeGenreId: undefined,
  loading: false,

  fetchGenres: async () => {
    set({ loading: true });
    try {
      const genres = await mcpService.genres.list();
      set({ 
        genres, 
        loading: false,
        activeGenreId: get().activeGenreId || genres[0]?.id
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createGenre: async (name: string) => {
    try {
      const genre = await mcpService.genres.create(name);
      set(state => ({ genres: [...state.genres, genre] }));
    } catch (error) {
      throw error;
    }
  },

  updateGenre: async (id: string, name: string) => {
    try {
      const updatedGenre = await mcpService.genres.update(id, name);
      set(state => ({
        genres: state.genres.map(g => g.id === id ? updatedGenre : g)
      }));
    } catch (error) {
      throw error;
    }
  },

  deleteGenre: async (id: string) => {
    try {
      await mcpService.genres.delete(id);
      set(state => ({
        genres: state.genres.filter(g => g.id !== id),
        activeGenreId: state.activeGenreId === id ? state.genres[0]?.id : state.activeGenreId
      }));
    } catch (error) {
      throw error;
    }
  },

  setActiveGenre: (id: string) => {
    set({ activeGenreId: id });
  },
}));