import { useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ExternalLink, MessageSquare, Languages, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { Article } from '@/types';

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const { openLlmPanel } = useUiStore();
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-start space-x-2 flex-1 text-left mr-4 hover:text-blue-600 transition-colors">
                <div className="mt-1 flex-shrink-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                  {article?.title || 'タイトルなし'}
                </h3>
              </button>
            </CollapsibleTrigger>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex-shrink-0"
            >
              <a
                href={article?.link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
              >
                <ExternalLink className="h-4 w-4" />
                <span>開く</span>
              </a>
            </Button>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500 ml-6">
            {article?.feed?.title && (
              <span className="font-medium">{article.feed.title}</span>
            )}
            {article?.published && (
              <span>{formatDate(article.published)}</span>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {(article?.contentSnippet || article?.description) && (
              <div className="mb-4 ml-6">
                <p className="text-gray-700 leading-relaxed">
                  {article.contentSnippet || article.description}
                </p>
              </div>
            )}

            <div className="flex space-x-2 ml-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLlmPanel(article, 'summarize')}
                className="flex items-center space-x-1"
              >
                <FileText className="h-4 w-4" />
                <span>要約</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLlmPanel(article, 'translate')}
                className="flex items-center space-x-1"
              >
                <Languages className="h-4 w-4" />
                <span>翻訳</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLlmPanel(article, 'ask')}
                className="flex items-center space-x-1"
              >
                <MessageSquare className="h-4 w-4" />
                <span>質問</span>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};