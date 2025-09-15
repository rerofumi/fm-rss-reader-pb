# 02. バックエンド仕様書

本書は「01_claim.md」で定義された要求を満たすバックエンドの詳細仕様を定義する。バックエンドは以下の3要素で構成する。

- PocketBase auth による認証と JWT セッション
- Model Context Protocol (MCP) 仕様の JSON-RPC インターフェース API
- LLM 問い合わせ Bridge API（OpenRouter 経由）

前提:
- バックエンドは PocketBase を中核に、静的フロントエンド配信、ユーザー認証、カスタム API（RSS 取得や LLM 連携）を提供する。
- LLM プロバイダは OpenRouter を利用し、API キーは PocketBase のサーバー側にのみ保持する（フロント非公開）。
- RSS 表示は都度リアルタイム取得（サーバー側実行）でキャッシュしない（本仕様書の主題は3要素だが、設計整合のため明示）。

---

## 1. アーキテクチャ概要

- コンポーネント
  - PocketBase（PB）: 認証、DB、静的配信、サーバー API 実行コンテキスト
  - Custom API（PB のルーター拡張）: MCP JSON-RPC、LLM Bridge
  - OpenRouter: LLM 呼び出しの外部依存
- デプロイ/実行
  - 単一プロセス（PocketBase）で稼働し、`/` でフロントを配信、`/api/*` および `/mcp/*` で API を提供
- ベース URL
  - 例: `https://<host>`
  - REST: `https://<host>/api/...`
  - MCP JSON-RPC: `https://<host>/mcp/rss`
- CORS/CSRF
  - フロント配信元と同一オリジンを基本とする
  - 外部クライアント（MCP クライアント等）は Bearer 認証（JWT or MCP トークン）を使用

---

## 2. 認証とセッション（PocketBase auth + JWT）

### 2.1 ログイン/ログアウト
- ユーザー登録は PocketBase を直接操作（UI は提供しない）
- ログイン: PB の標準エンドポイントを使用
  - `POST /api/collections/users/auth-with-password`
  - 成功時、PocketBase の JWT（以降 pbJWT）を受領
- ログアウト: クライアント側でセッション削除（サーバー側のブラックリストは不要想定だが、必要に応じて実装可）

### 2.2 セッション保持
- クッキー名（推奨）: `pb_session`
  - 値: pbJWT（PocketBase が発行）
  - 属性: HttpOnly, Secure, SameSite=Lax 以上
- 代替: Authorization: `Bearer <pbJWT>`（API クライアント用途）

### 2.3 認可
- すべての保護 API は pbJWT を検証し、`user.id` をコンテキストに付与
- フロントからの管理操作（設定・RSS 管理・MCP トークン発行など）は本人ユーザーに限定

### 2.4 エラー
- 認証失敗: 401 Unauthorized
- 認可不足: 403 Forbidden
- エラー JSON 形式（REST）
  - `{ "error": { "code": "<string>", "message": "<string>", "details": { ... } } }`

---

## 3. MCP JSON-RPC インターフェース

### 3.1 エンドポイント
- URL: `POST /mcp/rss`
- Content-Type: `application/json`
- プロトコル: JSON-RPC 2.0
- 認証: Bearer トークン（`MCP-<opaque token>` または PocketBase のユーザー JWT）。外部クライアントからは MCP トークンを推奨。

### 3.2 MCP アクセストークン
- 目的: 外部の LLM アプリケーションがユーザーの権限で MCP に接続するためのトークン
- 発行フロー（フロント専用操作）
  1) ユーザーが pbJWT でログイン済み
  2) `POST /api/mcp/tokens`（後述の REST）でトークンを発行
  3) フロント UI で表示・コピー（値は一度のみ表示）
- 形式/保管
  - 表面文字列: `MCP-<ランダム文字列>`
  - DB: ハッシュ化して保存（漏洩時に無効化可能）
  - フィールド例: id, userId, tokenHash, scopes, expiresAt, createdAt, lastUsedAt, name(optional)
- 権限/スコープ
  - 例: `llm.read`, `llm.write`, `tools.call`
  - 既定は最小権限（llm.call 系のみに限定）

### 3.3 サポートする JSON-RPC メソッド
- `mcp.initialize` → サーバー能力の返却
- `mcp.shutdown`
- `tools/list` → 呼び出し可能ツール一覧を返却
- `tools/call` → 指定ツールの実行

#### 3.3.0 レスポンスフォーマット（MCP 準拠）
- 本実装では、`tools/call` の戻りを MCP の content 形式で返します。
  - 例: `{"result": { "content": [ { "type": "text", "text": "<アプリ固有のJSON文字列>" } ] }}`
  - アプリ固有のデータは JSON 文字列化して `content[0].text` に格納します。

### 3.3.1. 提供ツール（`tools/call` で呼び出し可能）

MCPサーバーは、以下のツールを提供します。すべてのツールは、ユーザーの認証情報（MCPトークン）に基づいて動作し、そのユーザーに紐づくデータのみを操作します。

#### ジャンル管理 (`genre.*`)

##### `genre.list`
- **説明**: ユーザーが登録したすべてのジャンルの一覧を取得します。
- **引数**: なし
- **戻り値**:
  ```json
  {
    "genres": [
      { "id": "genre_id_1", "name": "テクノロジー", "createdAt": "..." },
      { "id": "genre_id_2", "name": "スポーツ", "createdAt": "..." }
    ]
  }
  ```

##### `genre.create`
- **説明**: 新しいジャンルを作成します。
- **引数**:
  ```json
  {
    "name": "新しいジャンル名"
  }
  ```
- **戻り値**:
  ```json
  {
    "id": "new_genre_id",
    "name": "新しいジャンル名",
    "createdAt": "..."
  }
  ```

##### `genre.update`
- **説明**: 既存のジャンルの名前を変更します。
- **引数**:
  ```json
  {
    "id": "genre_id_to_update",
    "name": "新しいジャンル名"
  }
  ```
- **戻り値**:
  ```json
  {
    "id": "genre_id_to_update",
    "name": "新しいジャンル名",
    "updatedAt": "..."
  }
  ```

##### `genre.delete`
- **説明**: 指定したジャンルを削除します。このジャンルに紐づくすべてのRSSフィードも削除されます。
- **引数**:
  ```json
  {
    "id": "genre_id_to_delete"
  }
  ```
- **戻り値**:
  ```json
  {
    "success": true
  }
  ```

---

#### RSSフィード管理 (`feed.*`)

##### `feed.list`
- **説明**: 指定したジャンルに登録されているRSSフィードの一覧を取得します。
- **引数**:
  ```json
  {
    "genreId": "genre_id_1"
  }
  ```
- **戻り値**:
  ```json
  {
    "feeds": [
      { "id": "feed_id_1", "url": "https://example.com/rss1.xml", "title": "Example News 1", "createdAt": "..." },
      { "id": "feed_id_2", "url": "https://example.com/rss2.xml", "title": "Example News 2", "createdAt": "..." }
    ]
  }
  ```

##### `feed.add`
- **説明**: 指定したジャンルに新しいRSSフィードのURLを追加します。サーバー側でフィードを一度取得し、タイトルなどを自動設定します。
- **引数**:
  ```json
  {
    "genreId": "genre_id_1",
    "url": "https://new-rss-feed.com/feed.xml"
  }
  ```
- **戻り値**:
  ```json
  {
    "id": "new_feed_id",
    "url": "https://new-rss-feed.com/feed.xml",
    "title": "（サーバーで取得したフィードのタイトル）",
    "createdAt": "..."
  }
  ```

##### `feed.remove`
- **説明**: 指定したRSSフィードをジャンルから削除します。
- **引数**:
  ```json
  {
    "id": "feed_id_to_remove"
  }
  ```
- **戻り値**:
  ```json
  {
    "success": true
  }
  ```

---

#### 記事取得 (`articles.*`)

##### `articles.fetchByGenre`
- **説明**: 指定したジャンルに属するすべてのRSSフィードから記事を取得し、マージして時系列順（新しいものが先頭）に並べ替えたリストを返します。
- **引数**:
  ```json
  {
    "genreId": "genre_id_1",
    "limit": 50 
  }
  ```
- **戻り値**:
  ```json
  {
    "articles": [
      {
        "title": "記事タイトル1",
        "link": "https://example.com/article1",
        "published": "2025-09-15T10:00:00Z",
        "contentSnippet": "記事の冒頭部分...（最大400文字）",
        "description": "記事の短いプレビュー（最大100文字）",
        "feed": { "title": "フィードのタイトル", "url": "..." }
      }
    ]
  }
  ```

##### `articles.fetchByUrl`
- **説明**: 単一のRSSフィードURLから直接記事を取得します。この機能は、登録されていないフィードをプレビューする目的でも使用できます。
- **引数**:
  ```json
  {
    "url": "https://example.com/rss1.xml",
    "limit": 50
  }
  ```
- **戻り値**: `articles.fetchByGenre` と同様のアーティクルリスト。

### 3.4 バッチ/ストリーミング
- JSON-RPC バッチ呼び出しはサポート
- ストリーミングは REST の SSE を推奨（JSON-RPC のストリームは将来拡張）

---

## 4. LLM 問い合わせ Bridge API（REST）

### 4.1 目的
- フロントエンドおよび MCP ツール呼び出しから、OpenRouter への問い合わせをサーバー側で仲介（API キー秘匿）

### 4.2 エンドポイント
- `POST /api/llm/query`
  - 認証: pbJWT（Bearer または HttpOnly Cookie）または MCP トークン
  - リクエスト JSON
    - `type`: "summarize" | "translate" | "ask"
    - `payload`: オペレーションごとのパラメータ
    - `model`(optional): 例 `openai/gpt-4o-mini`, `google/gemini-1.5-pro-latest` など（OpenRouter モデル名）
    - `options`(optional): { maxTokens?, temperature?, topP? }
  - レスポンス JSON
    - `result`: オペレーション結果（文字列または構造化）
    - `usage`: { promptTokens, completionTokens, totalTokens }
    - `model`: 実際に使用したモデル
- `GET /api/llm/models`（任意）
  - 認証: pbJWT または MCP トークン
  - OpenRouter 側の利用許可モデル/既定モデルを返却（キャッシュ短命 60s 程度）

### 4.3 プロンプト方針（概要）
- summarize: 記事テキストの要約。長文はチャンク化して段階要約、最後に統合
- translate: 指定言語へ翻訳。文体/丁寧さはパラメータで調整
- ask: 質問 + 任意の context（記事本文など）を system / user 分離で渡す
- 禁則: API キー、内部メタ情報の漏洩防止指示を system で付与

### 4.4 エラー
- 400: バリデーション失敗（未知 type、必須パラメータ欠如）
- 401/403: 認証/認可失敗
- 429: レート制限
- 502/504: アップストリーム（OpenRouter）障害

---

## 5. セキュリティ

- 秘匿情報
  - OpenRouter API キーは PocketBase サーバー側にのみ保存（環境変数 or Settings のサーバー専用領域）。環境変数名は `OPENROUTER_API_KEY` とする。
  - DB には保存しない（必要なら KMS 等で暗号化した上で PB 設定に保持）
- 認可境界
  - `/mcp/rss` は Bearer（MCP トークン または pbJWT）を受け付ける。pbJWT はユーザー自身の操作のみ許可。
  - MCP トークン → 発行ユーザーの権限に限定、スコープ/TTL/失効対応
- レート制限（例）
  - `/api/llm/*` および `/mcp/rss tools/call` をユーザー単位で 20 req/min（調整可）
- 入力検証
  - JSON スキーマでサーバー側バリデーション
  - 最大トークン/最大文字数のサーバー側上限
- ログ
  - 個人情報/秘密情報はマスク
  - 要求/応答サイズ、レイテンシ、エラーコードを計測

---

## 6. 監視・運用

- メトリクス
  - LLM 呼び出し成功率、レイテンシ p50/p95、トークン消費
  - レート制限ヒット数
- 追跡
  - すべてのリクエストに `x-request-id` を付与・伝搬
- 監査
  - MCP トークンの発行/再表示不可/失効操作を監査ログに記録

---

## 7. データモデル（PocketBase コレクション）

- `mcp_tokens`
  - フィールド（PocketBase 0.30 仕様・snake_case）
    - `user`: relation -> users.id（所有者）
    - `key_prefix`: text（一意。プレーンの先頭数文字を保存し、一覧識別に使用）
    - `token_hash`: text（ハッシュのみ保存、プレーンは返さない）
    - `scopes`: json（例: ["tools.call", "rss.read", "rss.write"]）
    - `name`: text（任意識別子）
    - `expires_at`: datetime（任意）
    - `last_used_at`: datetime（任意）
    - `created`, `updated`: datetime（システム）
  - インデックス例: (user), UNIQUE(key_prefix), (token_hash), (expires_at), (last_used_at)
- 備考
  - RSS フィード/ジャンル管理コレクションは別仕様（本書の主題外）

---

## 8. エラーフォーマット（統一）

- REST
  - `{ "error": { "code": "<string>", "message": "<string>", "details": { ... } } }`
- JSON-RPC
  - 標準 `error` オブジェクト（`code`, `message`, `data`）
- コード指針（例）
  - `auth.invalid_credentials`, `auth.token_expired`, `auth.insufficient_scope`
  - `llm.upstream_error`, `llm.rate_limited`, `llm.invalid_params`

---

## 9. 非機能要求の適用

- パフォーマンス
  - LLM 呼び出しはタイムアウト（例 60s）と再試行（安全なもののみ）
  - RSS は都度取得（キャッシュしない）
- CORS
  - 既定: 同一オリジン許可
  - 外部 MCP クライアント用に Authorization ヘッダを許可
- 可観測性
  - OpenRouter へのコールに外部依存タイミング/再試行メトリクスを付与

---

## 10. REST 補助エンドポイント（MCP トークン管理）

- `POST /api/mcp/tokens`
  - 認証: pbJWT
  - body: { name?: string, scopes?: string[], expiresAt?: string(ISO8601) }
  - 返却: { token: string (一度だけ表示), id: string, expiresAt?: string }
- `GET /api/mcp/tokens`
  - 認証: pbJWT
  - 返却: { items: Array<{ id, name, scopes, expiresAt, lastUsedAt, createdAt }> }（token 値は返さない）
- `DELETE /api/mcp/tokens/:id`
  - 認証: pbJWT
  - 指定トークンを失効

---

## 付録 A: 例（フォーマットの参考）

- JSON-RPC: tools/list リクエスト例

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/list",
  "params": {}
}
```

- JSON-RPC: tools/call（articles.fetchByUrl）

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": {
    "name": "articles.fetchByUrl",
    "arguments": {
      "url": "https://example.com/feed.xml",
      "limit": 20
    }
  }
}
```

- JSON-RPC: tools/call 応答例（content[0].type = "text" に JSON 文字列を格納）

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"articles\": [ { \"title\": \"...\", \"link\": \"...\", \"published\": \"...\", \"description\": \"...\" } ]\n}"
      }
    ]
  }
}
```

- REST: /api/llm/query（translate）

```json
{
  "type": "translate",
  "payload": {
    "text": "This is a pen.",
    "targetLang": "ja"
  },
  "model": "openai/gpt-4o-mini",
  "options": { "temperature": 0.2 }
}
```

---

## 11. PocketBase 実装ディレクトリとエントリポイント（/api, /mcp/rss）

PocketBase の javascript hooks を使用し、`/api` と `/mcp/rss` を作成する。

### 11.1 推奨ディレクトリ構成

```text path=null start=null
pb_hooks/                 # JSVMフック（使う場合のみ）
  route.pb.js               # API エントリーポイント
```

- 備考
  - `/mcp/rss` は JSON-RPC 2.0 によるツール呼び出しエンドポイント。名称は機能（RSS/MCP）を表すためのもの。

