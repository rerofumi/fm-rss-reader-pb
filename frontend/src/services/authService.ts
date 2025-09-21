
import { buildApiUrl } from './apiUrl';

export const authService = {
  async login(identity: string, password: string) {
    const response = await fetch(buildApiUrl(`/api/collections/users/auth-with-password`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identity, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || '認証に失敗しました');
    }

    const data = await response.json();
    
    // PocketBase は { token, record } を返す
    if (data.token) {
      // JWT トークンを localStorage に保存
      localStorage.setItem('pb_jwt', data.token);
    }
    
    return data;
  },

  async checkSession() {
    const token = localStorage.getItem('pb_jwt');
    if (!token) {
      return false;
    }

    try {
      // トークンが有効かどうかを確認するために、認証が必要なエンドポイントを呼び出す
      const response = await fetch(buildApiUrl(`/api/mcp/tokens`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  },

  logout() {
    // JWT トークンを削除
    localStorage.removeItem('pb_jwt');
    sessionStorage.removeItem('pb_jwt');
    window.location.href = '/login';
  },

  getAuthHeaders() {
    const token = localStorage.getItem('pb_jwt');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }
};
