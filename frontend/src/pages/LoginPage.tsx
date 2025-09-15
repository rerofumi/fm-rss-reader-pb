import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rss } from 'lucide-react';

export const LoginPage = () => {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, isAuthed, loading: authLoading, checkSession } = useAuthStore();
  const { pushToast } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from || '/reader';

  // 初回ロード時に認証状態をチェック
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // 既にログイン済みの場合はリダイレクト
  useEffect(() => {
    if (!authLoading && isAuthed) {
      navigate(from, { replace: true });
    }
  }, [isAuthed, authLoading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identity.trim()) {
      pushToast('error', 'メールアドレスまたはユーザー名を入力してください');
      return;
    }
    
    if (!password) {
      pushToast('error', 'パスワードを入力してください');
      return;
    }

    setLoading(true);
    try {
      await login(identity.trim(), password);
      pushToast('success', 'ログインしました');
      navigate(from, { replace: true });
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 認証状態確認中は読み込み画面を表示
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // 既にログイン済みの場合は何も表示しない
  if (isAuthed) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Rss className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            RSS Reader
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            アカウントにログインしてください
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
            <CardDescription>
              メールアドレスまたはユーザー名とパスワードを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="identity">メールアドレス / ユーザー名</Label>
                <Input
                  id="identity"
                  type="text"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="user@example.com"
                  disabled={loading}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワード"
                  disabled={loading}
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};