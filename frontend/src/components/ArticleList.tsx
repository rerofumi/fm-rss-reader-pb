import { useGenreStore } from '@/stores/genreStore';
import { useArticleStore } from '@/stores/articleStore';
import { ArticleCard } from '@/components/ArticleCard';

export const ArticleList = () => {
  const { activeGenreId } = useGenreStore();
  const { articlesByGenre, loadingByGenre } = useArticleStore();

  if (!activeGenreId) return null;

  const articles = articlesByGenre[activeGenreId] || [];
  const loading = loadingByGenre[activeGenreId] || false;

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">記事がありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article, index) => (
        <ArticleCard key={`${article.link}-${index}`} article={article} />
      ))}
    </div>
  );
};