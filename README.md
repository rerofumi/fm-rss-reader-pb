#

バックエンドにpocketbaseを使用したRSS Readerです。RSSの読み込みや管理部分はMCP serverのtoolsとして定義しているためブラウザフロントエンドでの利用はもちろん、LLMエージェントからの利用も可能です。

## システム構成

バックエンド
- PocketBase + javascript extention
  - 認証、DB、APIをPocketBaseで実装しています
フロントエンド
- Vite+React
MCP server
- MCP RSS tools
- MCP token manager、フロントエンドにtoken発行

## 実行方法

### docker container のビルド、起動(推奨)

`compose.yaml`ファイル内に OPENROUTER_API_KEY を設定する箇所があるので、それを設定してください。
(API キー が無くても AI assist が使えないだけで RSS reader 自体は動作します)

コンテナをビルドした後 docker compose でコンテナを起動します。

```
docker compose build
docker compose up -d
```

### 開発環境、ローカル実行

pocketbase の実行バイナリをパスの通ったところに配置します。このリポジトリトップに pocketbase のバイナリを置いておくでも良いです。

まずフロントエンドをビルドします。
frontend ディレクトリに移動し以下を実行します。

```
npm install
npm build
```

"dist" ディレクトリにビルドされたファイルができているので、dist 以下を `pb_public` の下に移動します。

環境変数 `OPENROUTER_API_KEY` に OpenRouter の API キー を設定します。(API キー が無くても AI assist が使えないだけで RSS reader 自体は動作します)

`fm-rss-reader-pb` ディレクトリ直下で pocketbase を起動します。起動時に `pd_data`, `pd_hooks`, `pb_migrations`, `pb_public` のディレクトリを指定すると確実です。

```
pocketbase serve --dir (path)pb_data --hooksDir (path)pb_hooks --migrationsDir (path)pb_migrations --publicDir (path)pb_public
```

この状態で http サーバーが起動しているので `nttp://localhost:8090/` にアクセスします。

#### フロントエンド開発

pocketbase はあらかじめ起動しておきます。
`frontend` ディレクトリ下に移動し、`.env.example` を `.env` にコピーして作成します。

その状態で `npm run dev` を実行すると開発版の frontend が pocketbase とは別に起動します。ポートは `8080`。

port 8080 にアクセスした状態で frontend を開発していきます。

### MCP server access

docker、開発環境のどちらでも良いですがブラウザでRSS readerにログインして動作できる環境を用意します。
setting ページの中にMCP tokenタブがあり、そこでMCPアクセス用のトークンを作成できます。

エージェントアプリのMCP settingでHTTP接続を選び、RSS readerへのURLを設定します。HTTPアクセスヘッダー情報に"Authorization"を追加し、そこにMCP tokenをアクセスキーとして設定します。

```
Authorization: "Bearer MCP-xxxxxTOKENxxxxxxx"
```

### 共通、pocketbase 初回起動

`pb_data`ディレクトリおよびpocketbaseのDBファイルが存在しない場合、pocketbaseの起動時に`pb_data`が作られ、その中に必要なファイルが作られます。

そういった初回起動時、pocketbaseにはアカウントが作成されず管理パネルに誰もアクセスできないため、スーパーユーザー作成用のsecret token urlがコンソールに表示されています。
このコンソールに表示されたURLにアクセスするとスーパーユーザーのE-Mailとpassword登録画面が表示されるので、まずsuper userを作成します。

super userでpocketbase管理コンソール`http://localhost:8090/_/`にアクセスすることができます。
pocketbaseコンソールの詳細説明は省きますが、RSS Readerを利用する通常ユーザーは一人作成しておいてください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細については[LICENSE](LICENSE)ファイルを参照してください。

## 👤 作者

- **rerofumi** - [GitHub](https://github.com/rerofumi) - rero2@yuumu.org

