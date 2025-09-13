# PocketBase v0.23（JSVM）破壊的変更サマリー
原文: https://pocketbase.io/v023upgrade/jsvm/

このドキュメントは、v0.22.x から v0.23 へ移行する際に「何がどう変わったか」をコンセプト中心で短く整理したものです。

## 変更の全体像（古い知識の上書きポイント）

### 1) 命名・表記の標準化
- JSON/IP/URL/SMTP/TLS/JWT などの頭字語の大文字表記を統一。  

### 2) アプリケーション層の再設計（Dao 廃止 → $app 集約）
- これまで Dao に散らばっていた操作は $app に集約。  
- OAuth2 設定やメールテンプレートなど「アプリ設定の一部」がコレクション側のオプションへ移動し、より粒度の細かいカスタマイズに。  
- 「管理者」は専用モデルではなく、システムの認証コレクション「_superusers」のレコードとして扱われるように統一。  
- 外部認証（ExternalAuth）も専用モデルから「_externalAuths」コレクションのレコードへ統一。

### 3) レコード操作の簡素化（フォーム抽象の撤廃）
- RecordUpsertForm を廃止し、レコードの検証と保存は $app の単一操作で完結。  
- ファイルは「通常のフィールド値」として扱い、フォーム的なアップロード手順が不要に。  
- Web API と同様のフィールドモディファイア（加算・削除等）をサーバー側でも利用可能に。  
- 認証・検証・各種トークン生成はレコード中心の API に統合。

### 4) コレクションモデルの見直し（型付きフィールド・オプションフラット化）
- コレクションの型（Base/Auth/View）と、型付きフィールド（Number/Bool/Text/...）を導入し、宣言が明確に。  
- これまで options 下にネストされていた設定をフラット化し、Web API との整合性を強化。  
- システムフィールド（email/password など）も通常フィールド同様にオプション調整が可能に。  
- CollectionUpsertForm を廃止し、検証＋保存は $app で一元化。

### 5) マイグレーション API の刷新（dbx → transactional app）
- マイグレーション関数は DB ビルダーではなく「トランザクション内の app インスタンス」を受け取るように変更。  
→ DB だけでなく設定・ファイルシステム・メール送信など、アプリ全体の機能に一貫してアクセス可能。  
- 既存が自動生成のみなら「コレクションスナップショット生成＋履歴同期」での再構築が簡便。

### 6) ルーティングの刷新（Go 1.22 mux ベース）
- パスパラメータ表記が :param から {param}、ワイルドカードは {path...} に変更。  
- ミドルウェアはチェーン継続のために e.next() を明示的に呼ぶ設計へ。  
- 認証状態は e.auth に統一（管理者も _superusers の認証レコード）。  
- リクエスト情報の取得は e.requestInfo()、ボディは data から body へ命名統一。  
- 静的配信、パラメータ・クエリ・ヘッダ・ボディの扱いは「イベント（e）」中心に統一。

### 7) イベントフックの統合（Before/After 分離から一連フローへ）
- 多くのフックが「onX（e.next()）」型に統合され、前後フェーズの扱いが一本化。  
- HTTP コンテキストへの直接依存は廃止し、「リクエストイベント e」自体に集約。  
- コレクション/レコードの作成・更新・設定更新などのリクエストフックは「検証前に発火」するようになり、Nonempty 等の前処理が可能。  
- 管理者系のフックは「_superusers を対象にしたレコード系フック」へ置き換え。

### 8) 組み込みの振る舞い・その他
- アクティビティログのミドルウェアはデフォルト有効（成功ログを抑止したい場合のみ専用ミドルウェアを追加）。  
- HTTP クライアントはデフォルトの Content-Type: application/json を送らなくなったため、必要時は明示設定が必要。

---

## 影響が大きい領域（優先度の目安）
- コード構造: Dao/UpsertForm 依存部分の全面置換（→ $app とレコード/コレクション直編集へ）  
- ルーティング: パスパラメータ記法・ミドルウェア e.next()・認証取得方法の置換  
- 認証/権限: Admin の概念変更（_superusers レコード化）と外部認証のコレクション化  
- マイグレーション: dbx 前提の処理から app トランザクション前提への移行  
- 設定/オプション: コレクション options のフラット化と Web API との整合

このサマリーを前提に、具体的な API 名やメソッド差分は公式リファレンスにて必要なときに逐次確認してください。
JSVM Overview: https://pocketbase.io/docs/js-overview/
JSVM Event hooks: https://pocketbase.io/docs/js-event-hooks/
JSVM Routing: https://pocketbase.io/docs/js-routing/
JSVM Migrations: https://pocketbase.io/docs/js-migrations/
JSVM Collections: https://pocketbase.io/docs/js-collections/
JSVM Database: https://pocketbase.io/docs/js-database/
JSVM FileSystem: https://pocketbase.io/docs/js-filesystem/
JSVM Logging: https://pocketbase.io/docs/js-logging/
