import { create } from 'zustand';
import { llmService } from '@/services/llmService';
import type { LlmQueryResponse, Article } from '@/types';

interface LlmState {
  running: boolean;
  result?: LlmQueryResponse;
  error?: string;
  abortController?: AbortController;
  summarize: (article: Article) => Promise<void>;
  translate: (article: Article, targetLang: string) => Promise<void>;
  ask: (article: Article, question: string) => Promise<void>;
  cancel: () => void;
  clearResult: () => void;
}

export const useLlmStore = create<LlmState>((set, get) => ({
  running: false,
  result: undefined,
  error: undefined,
  abortController: undefined,

  summarize: async (article: Article) => {
    const controller = new AbortController();
    set({ running: true, error: undefined, result: undefined, abortController: controller });

    try {
      const result = await llmService.query({
        type: 'summarize',
        payload: { 
          text: article.contentSnippet || article.description || article.title,
          articleUrl: article.link,
        },
      });
      
      if (!controller.signal.aborted) {
        set({ running: false, result, abortController: undefined });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        set({ 
          running: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          abortController: undefined 
        });
      }
    }
  },

  translate: async (article: Article, targetLang: string) => {
    const controller = new AbortController();
    set({ running: true, error: undefined, result: undefined, abortController: controller });

    try {
      const result = await llmService.query({
        type: 'translate',
        payload: { 
          text: article.contentSnippet || article.description || article.title,
          targetLang 
        },
      });
      
      if (!controller.signal.aborted) {
        set({ running: false, result, abortController: undefined });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        set({ 
          running: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          abortController: undefined 
        });
      }
    }
  },

  ask: async (article: Article, question: string) => {
    const controller = new AbortController();
    set({ running: true, error: undefined, result: undefined, abortController: controller });

    try {
      const result = await llmService.query({
        type: 'ask',
        payload: { 
          question,
          context: article.contentSnippet || article.description || article.title,
          articleUrl: article.link,
        },
      });
      
      if (!controller.signal.aborted) {
        set({ running: false, result, abortController: undefined });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        set({ 
          running: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          abortController: undefined 
        });
      }
    }
  },

  cancel: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ running: false, abortController: undefined });
    }
  },

  clearResult: () => {
    set({ result: undefined, error: undefined });
  },
}));