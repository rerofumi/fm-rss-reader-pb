import { useEffect } from 'react';
import { useGenreStore } from '@/stores/genreStore';
import { useArticleStore } from '@/stores/articleStore';
import { useUiStore } from '@/stores/uiStore';
import { GenreTabs } from '@/components/GenreTabs';
import { ArticleList } from '@/components/ArticleList';
import { LlmPanel } from '@/components/LlmPanel';

export const ReaderPage = () => {
  const { genres, activeGenreId, fetchGenres } = useGenreStore();
  const { fetchArticles } = useArticleStore();
  const { pushToast } = useUiStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchGenres();
      } catch (error) {
        pushToast('error', 'ジャンルの取得に失敗しました');
      }
    };
    
    loadData();
  }, [fetchGenres, pushToast]);

  useEffect(() => {
    if (activeGenreId) {
      const loadArticles = async () => {
        try {
          await fetchArticles(activeGenreId);
        } catch (error) {
          pushToast('error', '記事の取得に失敗しました');
        }
      };
      
      loadArticles();
    }
  }, [activeGenreId, fetchArticles, pushToast]);

  if (genres.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          ジャンルが登録されていません。管理画面からジャンルとフィードを追加してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GenreTabs />
      <ArticleList />
      <LlmPanel />
    </div>
  );
};