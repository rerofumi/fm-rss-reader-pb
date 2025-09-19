import { useEffect, useState } from 'react';
import { useGenreStore } from '@/stores/genreStore';
import { useFeedStore } from '@/stores/feedStore';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';
import type { Genre } from '@/types';

export const GenreManager = () => {
  const { genres, fetchGenres, createGenre, updateGenre, deleteGenre, setActiveGenre, activeGenreId } = useGenreStore();
  const { feedsByGenre, loading, fetchFeeds, addFeed, removeFeed } = useFeedStore();
  const { pushToast } = useUiStore();

  const [newGenreName, setNewGenreName] = useState('');
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [editGenreName, setEditGenreName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isCreatingGenre, setIsCreatingGenre] = useState(false);
  const [isAddingFeed, setIsAddingFeed] = useState(false);

  useEffect(() => {
    fetchGenres().catch(() => {
      pushToast('error', 'ジャンルの取得に失敗しました');
    });
  }, [fetchGenres, pushToast]);

  useEffect(() => {
    if (activeGenreId) {
      fetchFeeds(activeGenreId).catch(() => {
        pushToast('error', 'フィードの取得に失敗しました');
      });
    }
  }, [activeGenreId, fetchFeeds, pushToast]);

  const handleCreateGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) return;

    setIsCreatingGenre(true);
    try {
      await createGenre(newGenreName.trim());
      setNewGenreName('');
      pushToast('success', 'ジャンルを作成しました');
      
      // ジャンルリストを再取得してUIを更新
      await fetchGenres();
    } catch (error) {
      pushToast('error', 'ジャンルの作成に失敗しました');
    } finally {
      setIsCreatingGenre(false);
    }
  };

  const handleUpdateGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGenre || !editGenreName.trim()) return;

    try {
      await updateGenre(editingGenre.id, editGenreName.trim());
      setEditingGenre(null);
      setEditGenreName('');
      pushToast('success', 'ジャンル名を更新しました');
      
      // ジャンルリストを再取得してUIを更新
      await fetchGenres();
    } catch (error) {
      pushToast('error', 'ジャンル名の更新に失敗しました');
    }
  };

  const handleDeleteGenre = async (genre: Genre) => {
    if (!genre || !genre.id) {
      pushToast('error', '無効なジャンルです');
      return;
    }
    
    try {
      await deleteGenre(genre.id);
      pushToast('success', 'ジャンルを削除しました');
      
      // ジャンルリストを再取得してUIを更新
      await fetchGenres();
    } catch (error) {
      pushToast('error', 'ジャンルの削除に失敗しました');
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGenreId || !newFeedUrl.trim()) return;

    // URL バリデーション
    try {
      new URL(newFeedUrl.trim());
    } catch {
      pushToast('error', '有効な URL を入力してください');
      return;
    }

    setIsAddingFeed(true);
    try {
      await addFeed(activeGenreId, newFeedUrl.trim());
      setNewFeedUrl('');
      pushToast('success', 'フィードを追加しました');
      
      // フィードリストを再取得してUIを更新
      await fetchFeeds(activeGenreId);
    } catch (error) {
      pushToast('error', 'フィードの追加に失敗しました');
    } finally {
      setIsAddingFeed(false);
    }
  };

  const handleRemoveFeed = async (feedId: string) => {
    if (!activeGenreId) return;

    try {
      await removeFeed(feedId, activeGenreId);
      pushToast('success', 'フィードを削除しました');
      
      // フィードリストを再取得してUIを更新
      await fetchFeeds(activeGenreId);
    } catch (error) {
      pushToast('error', 'フィードの削除に失敗しました');
    }
  };

  const startEditGenre = (genre: Genre) => {
    if (!genre || !genre.id) {
      pushToast('error', '無効なジャンルです');
      return;
    }
    
    setEditingGenre(genre);
    setEditGenreName(genre.name);
  };

  const cancelEditGenre = () => {
    setEditingGenre(null);
    setEditGenreName('');
  };

  const currentFeeds = activeGenreId ? feedsByGenre[activeGenreId] || [] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ジャンル管理 */}
      <Card>
        <CardHeader>
          <CardTitle>ジャンル管理</CardTitle>
          <CardDescription>
            RSS フィードを分類するジャンルを管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateGenre} className="flex space-x-2">
            <Input
              value={newGenreName}
              onChange={(e) => setNewGenreName(e.target.value)}
              placeholder="新しいジャンル名"
              disabled={isCreatingGenre}
            />
            <Button type="submit" disabled={isCreatingGenre || !newGenreName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          <div className="space-y-2">
            {genres.map((genre) => {
              if (!genre) return null;
              
              return (
                <div
                  key={genre.id || `genre-${Math.random()}`}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    activeGenreId === genre.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (genre.id) {
                      setActiveGenre(genre.id);
                    }
                  }}
                >
                  {editingGenre?.id === genre.id ? (
                    <form onSubmit={handleUpdateGenre} className="flex-1 flex space-x-2">
                      <Input
                        value={editGenreName}
                        onChange={(e) => setEditGenreName(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" size="sm">
                        保存
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEditGenre}>
                        キャンセル
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="font-medium">{genre.name}</span>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditGenre(genre);
                          }}
                          disabled={!genre.id}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              disabled={!genre.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ジャンルを削除</AlertDialogTitle>
                              <AlertDialogDescription>
                                「{genre.name}」を削除しますか？この操作は取り消せません。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteGenre(genre)}
                                disabled={!genre.id}
                              >
                                削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* フィード管理 */}
      <Card>
        <CardHeader>
          <CardTitle>フィード管理</CardTitle>
          <CardDescription>
            {activeGenreId ? '選択されたジャンルのフィードを管理します' : 'ジャンルを選択してください'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeGenreId && (
            <>
              <form onSubmit={handleAddFeed} className="space-y-2">
                <Label htmlFor="feed-url">フィード URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="feed-url"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    disabled={isAddingFeed}
                  />
                  <Button type="submit" disabled={isAddingFeed || !newFeedUrl.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentFeeds.map((feed) => {
                    if (!feed) return null;
                    
                    return (
                      <div
                        key={feed.id || `feed-${Math.random()}`}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {feed.title || 'タイトル未取得'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {feed.url || ''}
                          </p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            disabled={!feed.url}
                          >
                            <a
                              href={feed.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          {feed.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>フィードを削除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    このフィードを削除しますか？この操作は取り消せません。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemoveFeed(feed.id)}>
                                    削除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && currentFeeds.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  フィードが登録されていません
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};