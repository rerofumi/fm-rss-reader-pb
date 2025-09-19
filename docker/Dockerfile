# ステージ1: ビルド環境
FROM node:24 as builder

ARG PB_VERSION=0.30.0

# アプリケーションの作業ディレクトリを設定
WORKDIR /app

# pocketbase のインストール
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /app/

# package.json と package-lock.json をコピーして、依存関係をインストール
# frontend ディレクトリ内のファイルを指定
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# frontend ディレクトリのソースコードをコピー
COPY frontend/ ./

# アプリケーションをビルド
RUN npm run build

# ステージ2: 本番環境
FROM debian:stable-slim

RUN apt update
RUN apt install -y curl

RUN mkdir -p /app
WORKDIR /app

# ビルドステージで生成された静的ファイルを pocketbase の配信用ディレクトリにコピー
COPY --from=builder /app/dist /app/pb_public
COPY --from=builder /app/pocketbase /app/pocketbase

# pocketmbase 設定をコピー
COPY pb_migrations/ ./pb_migrations/
COPY pb_hooks/ ./pb_hooks/
RUN mkdir -p pb_data

# 初期 DB 作成
RUN /app/pocketbase migrate

# ポート 8090 を公開
EXPOSE 8090

# Start server.
CMD ["/app/pocketbase", "serve", "--http", "0.0.0.0:8090", "--dir", "/app/pb_data", "--hooksDir", "/app/pb_hooks", "--migrationsDir", "/app/pb_migrations"]
