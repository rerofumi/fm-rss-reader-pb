import { create } from 'zustand';
import type { Toast, Article } from '@/types';

interface UiState {
  toasts: Toast[];
  llmPanel: {
    open: boolean;
    article?: Article;
    activeTab?: 'summarize' | 'translate' | 'ask';
  };
  pushToast: (type: Toast['type'], message: string) => void;
  closeToast: (id: string) => void;
  openLlmPanel: (article: Article, tab?: 'summarize' | 'translate' | 'ask') => void;
  closeLlmPanel: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  llmPanel: {
    open: false,
    article: undefined,
    activeTab: undefined,
  },

  pushToast: (type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    const toast: Toast = { id, type, message };
    
    set(state => ({ toasts: [...state.toasts, toast] }));
    
    // 5秒後に自動削除
    setTimeout(() => {
      get().closeToast(id);
    }, 5000);
  },

  closeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  openLlmPanel: (article: Article, tab: 'summarize' | 'translate' | 'ask' = 'summarize') => {
    set({ llmPanel: { open: true, article, activeTab: tab } });
  },

  closeLlmPanel: () => {
    set({ llmPanel: { open: false, article: undefined, activeTab: undefined } });
  },
}));