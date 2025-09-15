# 04. フロントエンド仕様書

本書は「01_claim.md」の要求と「02_backend_specification.md」のバックエンド仕様に基づき、Vite + React + TypeScript + Zustand + Tailwind CSS を用いたフロントエンドの詳細仕様を定義する。

---

## 1. 目的と範囲
- 個人利用の小規模 RSS Reader を提供する。
- ログイン必須。未ログイン時はログインページへ強制遷移。
- ページは3つ：
  - ログイン
  - RSS Reader（ニュース一覧）
  - 管理（ジャンル・RSS URL・MCPトークン管理）
- バックエンドとの通信は以下を使用：
  - MCP JSON-RPC（/mcp/rss）: RSS 機能（ジャンル・フィード・記事）
  - REST（/api/llm/*, /api/mcp/tokens）: LLM ブリッジ、MCP トークン管理
  - PocketBase Auth 標準エンドポイント: ログイン
- 非機能要件の順守：API キー秘匿、キャッシュしない RSS 取得、同一オリジンでの配信と Cookie ベースのセッションなど。

---

## 2. 画面構成とルーティング

### 2.1 ルーティング
- 「/login」: ログイン画面
- 「/reader」: RSS Reader 画面（デフォルト遷移先。初回アクセスもここへ）
- 「/admin」: 管理画面
- 未ログイン時は「/login」にリダイレクト。ログイン後は直前の保護ページへ遷移、なければ「/reader」。

### 2.2 共通レイアウト（AppShell）
- ヘッダーナビゲーション
  - アプリ名（クリックで /reader）
  - ナビリンク: Reader（/reader）, Admin（/admin）
  - 右側: ログインユーザー表示（メールまたは ID）、ログアウトボタン
- コンテンツエリア
  - Nested Routes で各画面をレンダリング
- トースト/通知領域
  - 成功/警告/エラーの簡易通知（Zustand 経由で発火）

### 2.3 ログイン画面（/login）
- フォーム
  - identity（メール or ユーザー名）
  - password
  - ログインボタン（submit）
- バリデーション
  - identity: 未入力禁止
  - password: 未入力禁止
- 動作
  - PB 標準 API でログイン成功時、サーバーから HttpOnly Cookie（pb_session）が設定される
  - 成功後 Reader へ遷移、または遷移元へ復帰
- エラー表示
  - 401/400 などをユーザー向けメッセージに変換（「認証に失敗しました」等）

### 2.4 RSS Reader 画面（/reader）
- 上部: ジャンルタブ（横スクロール可）
  - 選択中のジャンルに応じて記事一覧が変わる
  - 先頭に「すべて」タブは置かない（要求通りジャンル単位で表示）
- 記事一覧（新しい順）
  - アイテム要素: タイトル、配信元（フィード名）、公開日時、抜粋、外部リンク
  - アクション: 
    - 外部リンクを新規タブで開く
    - 「要約」「翻訳」「質問」アクション（LLM パネルを開く）
- LLM パネル（サイドドロワーまたはモーダル）
  - 選択中記事に対する操作:
    - 要約（summarize）
    - 翻訳（translate: 言語選択）
    - 質問（ask: 自由入力）
  - 実行結果の表示（Markdown 表示可能）
  - 実行中はスピナー/進捗を表示、キャンセル可能（AbortController）
- リロード
  - ジャンル切替ごとに都度リアルタイム取得（キャッシュしない）

### 2.5 管理画面（/admin）
- タブ: 「ジャンル/フィード」「MCP トークン」

1) ジャンル/フィード管理
- ジャンル一覧
  - 追加（name）、名称変更、削除（確認ダイアログ）
- フィード一覧（選択ジャンル）
  - 追加（url）、削除
  - 追加時はサーバーがフィードに一度アクセスしタイトル等を保存
- バリデーション
  - name: 長さ 1..50、重複名は許可（DB 的には可能だが UI では識別に注意）
  - url: 有効な URL（http/https）、重複 URL は警告

2) MCP トークン管理
- 一覧表示（id, name, scopes, expiresAt, lastUsedAt, createdAt）
- 追加（name?, scopes?, expiresAt?）
  - 作成レスポンスの token は一度だけ表示→コピー機能（再表示不可の注意テキスト）
- 削除

---

## 3. バックエンド連携（API/プロトコル）

### 3.1 認証（PocketBase auth + Cookie）
- ログイン
  - POST /api/collections/users/auth-with-password
  - body: { identity: string, password: string }
  - 成功時: サーバーが HttpOnly Cookie `pb_session` を設定
- フロントの fetch 設定
  - 同一オリジン前提。`credentials: 'include'` を常に指定
  - Authorization ヘッダは不要（Cookie ベース）
- セッション確認
  - 例: GET /api/mcp/tokens（200: ログイン、401: 未ログイン）を軽量ヘルスチェックとして使用
- ログアウト
  - クライアント側で Cookie を削除する API は無いので、アプリ側はセッション破棄として「ログイン状態フラグを落とし、リロード」
  - 必要であればサーバー側に失効エンドポイントを追加（将来拡張）

### 3.2 MCP JSON-RPC（/mcp/rss）
- エンドポイント
  - POST /mcp/rss
  - Content-Type: application/json, JSON-RPC 2.0
  - 認証: 同一オリジン + Cookie（推奨）
- レスポンス（tools/call）
  - result.content[0].type = "text"
  - result.content[0].text にアプリ固有 JSON 文字列が入る → JSON.parse して利用
- サポートメソッド（名称はバックエンド仕様に準拠）
  - genre.list → ジャンル一覧
  - genre.create(name)
  - genre.update(id, name)
  - genre.delete(id)
  - feed.list(genreId)
  - feed.add(genreId, url)
  - feed.remove(id)
  - articles.fetchByGenre(genreId, limit)
  - articles.fetchByUrl(url, limit)
- 例：`articles.fetchByGenre`
  - req: { jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'articles.fetchByGenre', arguments: { genreId, limit } } }
  - res: result.content[0].text → { articles: Article[] }

### 3.3 LLM ブリッジ（REST）
- POST /api/llm/query
  - 認証: Cookie（pb_session）
  - body: { type: 'summarize'|'translate'|'ask', payload: object, model?, options? }
  - 戻り: { result: string|object, usage: {...}, model: string }
- GET /api/llm/models（任意）
  - 認証: Cookie
  - 戻り: 利用可能モデル一覧（キャッシュ短命）
- payload 例
  - summarize: { text: string }
  - translate: { text: string, targetLang: string }
  - ask: { question: string, context?: string }

### 3.4 MCP トークン管理（REST）
- POST /api/mcp/tokens
  - body: { name?: string, scopes?: string[], expiresAt?: string }
  - 戻り: { token: string(一度のみ), id: string, expiresAt?: string }
- GET /api/mcp/tokens
  - 戻り: { items: Array<{ id, name, scopes, expiresAt, lastUsedAt, createdAt }> }
- DELETE /api/mcp/tokens/:id

---

## 4. データモデル（TypeScript 型：フロント定義）
```ts
export type Genre = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

export type Feed = {
  id: string
  url: string
  title?: string
  createdAt?: string
}

export type Article = {
  title: string
  link: string
  published?: string // ISO8601
  contentSnippet?: string // <= 400 chars server policy
  description?: string // <= 100 chars server policy
  feed?: { title?: string; url?: string }
}

export type LlmQueryType = 'summarize' | 'translate' | 'ask'

export type LlmQueryRequest = {
  type: LlmQueryType
  payload: Record<string, unknown>
  model?: string
  options?: { maxTokens?: number; temperature?: number; topP?: number }
}

export type LlmQueryResponse = {
  result: string | Record<string, unknown>
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  model?: string
}
```

---

## 5. 状態管理（Zustand ストア設計）

- authStore
  - state: { isAuthed: boolean, loading: boolean, user?: { id: string; email?: string } }
  - actions: login(identity, password), checkSession(), logout()
- genreStore
  - state: { genres: Genre[], activeGenreId?: string, loading: boolean }
  - actions: fetchGenres(), createGenre(name), updateGenre(id, name), deleteGenre(id), setActiveGenre(id)
- feedStore
  - state: { feedsByGenre: Record<string, Feed[]>, loading: boolean }
  - actions: fetchFeeds(genreId), addFeed(genreId, url), removeFeed(feedId, genreId)
- articleStore
  - state: { articlesByGenre: Record<string, Article[]>, loadingByGenre: Record<string, boolean> }
  - actions: fetchArticles(genreId, limit)
- llmStore
  - state: { running: boolean, result?: LlmQueryResponse, error?: string }
  - actions: summarize(article), translate(article, targetLang), ask(article, question), cancel()
- tokenStore（MCP）
  - state: { items: Array<{ id: string; name?: string; scopes?: string[]; expiresAt?: string; lastUsedAt?: string; createdAt?: string }>, creatingToken?: string|null, loading: boolean }
  - actions: list(), create(params), remove(id)
- uiStore
  - state: { toasts: Array<{ id: string; type: 'success'|'warning'|'error'; message: string }>, llmPanel: { open: boolean; article?: Article } }
  - actions: pushToast(msg), closeToast(id), openLlmPanel(article), closeLlmPanel()

---

## 6. コンポーネント設計（主なもの）

- AppShell（共通レイアウト）
- ProtectedRoute（認証ガード）
- LoginForm（identity/password）
- GenreTabs（一覧 + 追加/編集/削除は管理画面、Reader は選択のみ）
- ArticleList（仮想化対応可）
- ArticleCard（タイトル、フィード名、日時、抜粋、リンク、LLM アクション）
- LlmPanel（要約/翻訳/質問フォームと結果表示）
- AdminView
  - GenreManager（一覧、追加、名称変更、削除）
  - FeedManager（選択ジャンルのフィード一覧、追加/削除）
  - McpTokenManager（一覧、作成（トークン一度だけ表示）、削除）
- Toast（通知）

---

## 7. サービス層（API 呼び出しラッパー）

共通: `credentials: 'include'` を必ず指定。JSON-RPC の応答は `result.content[0].text` を JSON.parse。

- authService
  - login(identity, password): POST /api/collections/users/auth-with-password
  - check(): GET /api/mcp/tokens（200/401 判定用）
- mcpService（/mcp/rss）
  - call(name: string, args: object)
  - genres: list(), create(name), update(id, name), delete(id)
  - feeds: list(genreId), add(genreId, url), remove(id)
  - articles: fetchByGenre(genreId, limit), fetchByUrl(url, limit)
- llmService
  - query(req: LlmQueryRequest): POST /api/llm/query
  - models(): GET /api/llm/models
- tokenService（MCP）
  - list(): GET /api/mcp/tokens
  - create(params): POST /api/mcp/tokens（戻り token は一度だけ表示）
  - remove(id): DELETE /api/mcp/tokens/:id

---

## 8. 入力バリデーション

- ログイン
  - identity: 必須
  - password: 必須
- ジャンル
  - name: 1..50 文字。前後空白はトリム。重複は警告（許可）
- フィード
  - url: 必須、http(s) のみ、長さ <= 2,048
- 記事取得
  - limit: 1..100 を上限（UI 既定 50）
- LLM
  - summarize: text 必須
  - translate: text 必須、targetLang 必須（例: ja, en）
  - ask: question 必須、context 任意

---

## 9. エラー処理・メッセージング

- サーバーの統一エラーフォーマットに準拠
  - REST: { error: { code, message, details } }
  - JSON-RPC: error { code, message, data }
- UI 表示方針
  - 認証系: 「認証に失敗しました」「セッションが期限切れです」
  - バリデーション: 入力欄内にインライン表示 + トースト
  - ネットワーク/上流障害: 「現在サーバーが混み合っています」
- リトライ
  - 一時的な 502/504/429 はバックオフ付き任意リトライ

---

## 10. セキュリティ

- pb_session は HttpOnly Cookie。フロントから値へアクセスしない
- Authorization ヘッダでの JWT 送信は行わない（同一オリジン + Cookie）
- MCP トークンは作成時のみプレーン値を表示。LocalStorage などへ保存しない。コピー操作と注意喚起のみ
- OpenRouter API キーはサーバーのみ保持（要求事項順守）
- XSS/リンク
  - 記事抜粋/説明はサニタイズまたは安全テキスト扱い
  - 外部リンクは rel="noopener noreferrer" を付与

---

## 11. パフォーマンス・UX

- 記事一覧はキャッシュせず都度取得（要求順守）。ユーザー操作に応じスケルトン UI を表示
- 長い一覧は仮想スクロール（react-virtual など検討）
- リクエストは AbortController で中断可能
- 並列取得は最小限（ジャンル切替時の単発取得が基本）

---

## 12. アクセシビリティ・i18n

- キーボード操作対応（タブ移動、フォーカス可視化）
- スクリーンリーダー向けラベル
- 日時はローカライズ表記（Intl.DateTimeFormat）

---

## 13. スタイリング（Tailwind）

- カラーパレット: ライト/ダーク（任意）。コントラスト比を確保
- コンポーネント単位のユーティリティクラス整備
- 共通余白・フォントサイズのスケールを設定

---

## 14. ビルド・配信

- Vite（React + TS）でビルド
- 生成物を PocketBase の静的配信に配置（同一オリジン動作を担保）
- fetch は相対パス（/api, /mcp）を使用

---

## 15. テスト方針

- 単体: サービス層（mcpService/llmService/tokenService/authService）の入出力をモックして検証
- 結合: 画面の主要フロー（ログイン → Reader → LLM 実行、Admin での登録/削除）
- E2E（任意）: 実シナリオでのエンドツーエンド

---

## 16. 想定シーケンス（主要フロー）

1) アプリ初期表示
- checkSession() → 200: /reader, 401: /login
- /reader: genres = genre.list → 最初のジャンルを active に → articles.fetchByGenre

2) 記事に対して LLM 要約
- UI で記事選択 → LlmPanel.open
- POST /api/llm/query { type: 'summarize', payload: { text } }
- 応答表示

3) 管理でフィード追加
- 選択ジャンルを指定 → feed.add(genreId, url)
- 成功後 feed.list をリフレッシュ

4) MCP トークン作成
- POST /api/mcp/tokens → token（プレーン）を一度だけ表示 → コピー
- 一覧は GET /api/mcp/tokens で確認（プレーンは返らない）

---

## 17. 未確定点・補足（確認事項）

- ログイン後のユーザー情報（メール/ID）取得 API は何を用いるか
  - 現状は /api/mcp/tokens の 200 をセッション確認に使用。ユーザー表示用の API（/api/users/me 等）が必要なら追加
- 記事本文テキストの取得方法
  - 要約/翻訳/質問の対象テキストは RSS の description/contentSnippet を利用するか、リンク先の本文をサーバー側で抽出するか
  - 現状は RSS データの範囲で操作（将来拡張で本文抽出ツールを MCP に追加可）
- LLM モデル選択 UI の露出
  - 既定モデル固定か、ドロップダウン提供か（/api/llm/models を用いる場合）

---

## 18. 実装ディレクトリ（例）

- src/
  - app/（ルート、ルーティング）
  - components/（UI コンポーネント）
  - pages/
    - LoginPage.tsx
    - ReaderPage.tsx
    - AdminPage.tsx
  - services/
    - authService.ts
    - mcpService.ts
    - llmService.ts
    - tokenService.ts
  - stores/
    - authStore.ts
    - genreStore.ts
    - feedStore.ts
    - articleStore.ts
    - llmStore.ts
    - tokenStore.ts
    - uiStore.ts
  - styles/
  - utils/

以上。
