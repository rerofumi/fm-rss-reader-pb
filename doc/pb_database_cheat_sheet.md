# PocketBase 0.30.0 Extend(JS VM) 開発用コンパクトガイド

目的: Extend からの DB アクセスとデータ操作の実務判断を、最小情報で迷わずできるようにする。

## レイヤと原則
- 入口: `$app`
- 優先順位
  1) Record API（CRUDの標準・安全経路）
  2) recordQuery（複雑な読み取りをRecordで受けたい時）
  3) db（$app.db）生SQL/ビルダー（高度集計・大量一括・イベント回避時のみ）
- 新規作成のみ `new Record(collection)` が必要＝この時だけ `Collection` を取得
- 読み取り・更新・削除はコレクション名（文字列）で十分（事前に Collection を取らない）

## Record（推奨の基本レイヤ）
- 単一取得
  - `$app.findRecordById("articles", id)`
  - `$app.findFirstRecordByData("articles", "slug", "x")`
  - `$app.findFirstRecordByFilter("articles", "status='public' && category={:c}", { c: "news" })`
- 複数取得
  - `$app.findRecordsByFilter("articles", "status='public'", "-published", 20, 0)`
  - `$app.findAllRecords("articles", $dbx.hashExp({ status: "pending" }))`
  - 集計: `$app.countRecords("articles", $dbx.hashExp({ status: "pending" }))`
- 作成/更新/削除
  - 作成: `const c=$app.findCollectionByNameOrId("articles"); const r=new Record(c); r.set(...); $app.save(r)`
  - 更新: `const r=$app.findRecordById(...); r.set(...); $app.save(r)`
  - 削除: `$app.delete(r)`
- ファイル
  - 追加: `record.set("files+", [ $filesystem.fileFromPath(...), ... ])`
  - 削除: `record.set("files-", ["old_name.pdf"])`
  - 生SQLでファイル列を更新しない（不整合の温床）
- リレーション展開
  - `$app.expandRecord(record, ["author", "tags"])`
- 可視性/整形
  - `onRecordEnrich` × `record.hide()/unhide()` を活用
- 認可/トークン
  - ビュー許可: `$app.canAccessRecord(record, e.requestInfo(), record.collection().viewRule)`
  - トークン発行/検証: `record.newAuthToken()`, `$app.findAuthRecordByToken(...)`

## recordQuery（柔軟な読み取り）
- 例: 上位10件
  - `let rs=arrayOf(new Record); $app.recordQuery("articles").andWhere($dbx.hashExp({status:"active"})).orderBy("rank ASC").limit(10).all(rs)`
- SELECT 限定。Record として受けたい複雑検索に最適

## Database（$app.db）を使うべき場面
- 多段JOIN、集計（groupBy/having）、EXISTS/NOT EXISTS、サブクエリなど高度な読み取り
- 一括更新/削除・バックフィルなど（イベントを発火させたくない/性能重視）
- マイグレーションや管理タスク（Recordのバリデーション/フックを回避したい）
- 注意
  - フック/バリデーション/ルールは通らない（必要なら別途適用）
  - パラメータは必ず `{:name}` + `.bind({ name })` でバインド
  - 書き込みの常用は避ける（通常ロジックは Record を使う）

## トランザクション
- `$app.runInTransaction((txApp) => { /* txApp を使用 */ })`
- 外部I/Oは避け短く保つ。ネストOKだが必ず `txApp` を使う（単一ライタ制御）

## Collection（スキーマ）
- 取得: `$app.findCollectionByNameOrId("example")`
- 作成/更新: `new Collection({...}); $app.save(collection)` / `collection.fields.add(...); $app.save(collection)`
- 用途: マイグレーション/スキーマ変更時のみ触るのが基本

## セキュリティとベストプラクティス
- すべての外部入力はバインド or `$dbx.hashExp()/like()`
- 通常CRUDは Record、複雑読取は recordQuery、どうしても必要な時だけ db
- 公開整形は `onRecordEnrich` + `hide/unhide`
- ファイルは Record API で操作
- 典型アンチパターン
  - 生SQLでファイル列更新
  - バインド未使用の文字列連結SQL
  - トランザクション中に元の `$app` を使う
  - 重い処理をトランザクション内で行う

## 最小レシピ
- CRUD
  - Find: `$app.findRecordById("articles", id)`
  - List: `$app.findRecordsByFilter("articles", "status='public'", "-published", 20, 0)`
  - Create: `new Record($app.findCollectionByNameOrId("articles"))` → `set()` → `save()`
  - Update/Delete: 取得 → `set()` / `$app.delete()`
- 高度検索
  - `recordQuery("articles").andWhere($dbx.like("title", "foo")).orderBy("created DESC").limit(50)`
- 一括更新（イベント回避）
  - `$app.db().newQuery("UPDATE articles SET status='archived' WHERE created < {:d}") .bind({ d }).execute()`
