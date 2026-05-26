# Card Scanner Project Memory

## 役割分担
- **Firebase Auth**: ユーザー認証（ログイン管理）。`user.uid`（文字列）を発行する。
- **Supabase**: データベース。
  - **profiles**: Firebase UID に紐づく「アプリ内アカウント」。
  - **inventory**: 特定のプロフィールに紐づく「カード所持データ」。

## Supabase スキーマ
### 1. profiles (アプリ内アカウント)
| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| id | bigint | PK (プロフィールID) |
| uuid | text | Firebase AuthのUID |
| p_uid | text | ユニークなランダム文字列 (外部キー用) |
| name | text | アカウント名 (例: メイン) |
| created_at | timestamp | 作成日時 |

### 2. inventory (カード情報)
| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| id | bigint | PK |
| p_uid | text | プロフィール固有文字列 (profiles.p_uid) |
| card_id | text | GAS提供のカードID |
| count | integer | 所持枚数 |
| created_at | timestamp | 登録日時 |

※ **重要**: `upsert` 操作を可能にするため、`(p_uid, card_id)` の組み合わせに UNIQUE 制約が必要。
`ALTER TABLE inventory ADD CONSTRAINT inventory_p_uid_card_id_unique UNIQUE (p_uid, card_id);` を実行済み。

### 3. RLS ポリシー (SQL - 必須設定)
Firebase Auth を使用する場合、Supabase 側では `anon` ロールに対して以下のポリシーを設定してください。

```sql
-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_universal_anon_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_insert" ON public.profiles; -- 古いポリシー名も削除
DROP POLICY IF EXISTS "profiles_anon_select" ON public.profiles; -- 古いポリシー名も削除
CREATE POLICY "profiles_universal_anon_access"
ON public.profiles
FOR ALL -- SELECT, INSERT, UPDATE, DELETE すべてを対象
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_universal_anon_access" ON public.inventory;
DROP POLICY IF EXISTS "inventory_full_access_v2" ON public.inventory;

CREATE POLICY "inventory_full_access_v2"
ON public.inventory
FOR ALL -- SELECT, INSERT, UPDATE, DELETE すべてを対象
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Supabase の内部キャッシュをリロードして変更を即座に適用
NOTIFY pgrst, 'reload schema';
```
※ セキュリティを強化する場合は、アプリケーション側で UID の検証を徹底すること。

## 実装のルール
1. **階層**: Auth User -> Profile -> Inventory の順でアクセスする。
2. **枚数登録**: 必ず `profile_id` を指定して `card_id` と `count` を保存する。
2. **エラーハンドリング**: 非同期処理には必ず `finally` を使い、`loading` 状態を解除すること。
3. **ビルド設定**: `output: 'export'` による静的エクスポートを使用するため、Firebase Hosting側で `trailingSlash: true` を設定する。

## 既知のトラブルシューティング
- **TypeScript 6.0警告**: `tsconfig.json` の `ignoreDeprecations` は `"5.0"` に設定すること。
- **Safariでの表示崩れ**: Turbopackは不安定なため、本番ビルドは `npx next build` を使用し、Safariのキャッシュを空にしてから確認する。
- **Unexpected token '<'**: 404エラー時にHTMLが返っているサイン。アセットパスやFirebaseの `rewrites` 設定を確認する。
- **ポート競合 (Another next dev server is already running)**: 以前のプロセスが残っている場合は `kill <PID>` で終了させる。
- **An unexpected Turbopack error occurred**: `.next` フォルダを削除してサーバーを再起動する。また、最近変更したファイルに未定義の変数の参照がないか確認する。
- **IO error / No space left on device (os error 28)**: ディスク容量不足。`.next` フォルダの削除や不要なファイルの整理が必要。

## 開発コマンド
```bash
# 開発用プレビュー (Hot Reload)
npm run dev

# 本番ビルドのローカルプレビュー (Firebaseデプロイ前の最終確認)
npm run build
npx serve out

# クリーンビルドとデプロイ
npx rimraf .next out # 標準のrmで消せない場合はnpx rimrafを推奨
npm run build
firebase deploy --only hosting
```
