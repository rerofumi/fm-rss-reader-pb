import { useEffect, useState } from 'react';
import { tokenService } from '@/services/tokenService';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import type { McpToken } from '@/types';

export const McpTokenManager = () => {
  const { pushToast } = useUiStore();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const tokenList = await tokenService.list();
      setTokens(tokenList);
    } catch (error) {
      pushToast('error', 'トークンの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setCreating(true);
    try {
      const result = await tokenService.create({
        name: newTokenName.trim() || undefined,
      });
      
      setCreatedToken(result.token);
      setShowTokenDialog(true);
      setNewTokenName('');
      await loadTokens();
      pushToast('success', 'トークンを作成しました');
    } catch (error) {
      pushToast('error', 'トークンの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteToken = async (id: string) => {
    try {
      await tokenService.remove(id);
      await loadTokens();
      pushToast('success', 'トークンを削除しました');
    } catch (error) {
      pushToast('error', 'トークンの削除に失敗しました');
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopiedToken(true);
      pushToast('success', 'トークンをクリップボードにコピーしました');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (error) {
      pushToast('error', 'コピーに失敗しました');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>MCP トークン管理</CardTitle>
          <CardDescription>
            MCP API にアクセスするためのトークンを管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateToken} className="space-y-4">
            <div>
              <Label htmlFor="token-name">トークン名（任意）</Label>
              <Input
                id="token-name"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="例: 開発用トークン"
                disabled={creating}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={creating} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>{creating ? '作成中...' : 'トークンを作成'}</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>トークン一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              トークンが作成されていません
            </p>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">
                        {token.name || `Token ${token.id.slice(0, 8)}`}
                      </span>
                      {token.scopes && token.scopes.length > 0 && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {token.scopes.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      <span>作成: {formatDate(token.createdAt)}</span>
                      {token.lastUsedAt && (
                        <span className="ml-4">最終使用: {formatDate(token.lastUsedAt)}</span>
                      )}
                      {token.expiresAt && (
                        <span className="ml-4">期限: {formatDate(token.expiresAt)}</span>
                      )}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>トークンを削除</AlertDialogTitle>
                        <AlertDialogDescription>
                          このトークンを削除しますか？この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteToken(token.id)}>
                          削除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* トークン表示ダイアログ */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>トークンが作成されました</DialogTitle>
            <DialogDescription>
              以下のトークンは一度だけ表示されます。安全な場所に保存してください。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono break-all flex-1 mr-2">
                  {createdToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToken}
                  className="flex-shrink-0"
                >
                  {copiedToken ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>重要:</strong> このトークンは再表示できません。必ずコピーして安全な場所に保存してください。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};