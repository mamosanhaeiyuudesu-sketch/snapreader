# リポジトリ運用ガイドライン
日本語で回答して

## プロジェクト構成とモジュール整理
- `app.vue` は単一ページUIです。ページが大きくなるまではUI状態と表示ロジックをここに置きます。
- `server/api/` にNitroサーバールートがあります。現在のAPIエントリポイントは `server/api/analyze.post.ts` です。
- `nuxt.config.ts` はランタイム設定とデプロイのプリセットを保持します。
- `wrangler.toml` はCloudflare Workersのデプロイ設定です。
- ビルド出力は `.output/`（生成物。手動で編集しない）。

## ビルド、テスト、開発コマンド
- `npm install`: 依存関係をインストールします。
- `npm run dev`: ローカル開発用にNuxtのdevサーバーを起動します。
- `npm run build`: Nitro/Cloudflare向けに本番ビルドします。
- `npm run start`: ビルド後にローカルで本番サーバーを起動します。
- `wrangler deploy`: ビルド出力をCloudflare Workersにデプロイします。

## コーディングスタイルと命名規則
- `.vue` と `.ts` はインデント2スペースです。
- Vue SFCはTypeScriptの `script setup` を使います（`<script setup lang="ts">`）。
- JS/TSの変数と関数はcamelCase、CSSクラスはkebab-caseです。
- APIルートはHTTP動詞で命名します（例: `server/api/analyze.post.ts`）。

## テスト方針
- 自動テストフレームワークは未設定です。
- 手動確認: `npm run dev` を実行し、画像をアップロードまたは撮影して要約が返ることを確認します。
- テストを追加する場合は、`npm run test` などのスクリプトも追加し、ここに記載します。

## コミットとプルリクのガイドライン
- 履歴のコミットメッセージは短く、日本語で1行です。チーム合意がない限りこの形式に従います。
- PRには、簡潔な説明、テスト手順、UI変更のスクリーンショットを含めます。
- PRの説明に関連するIssueやタスクをリンクします。

## 設定とセキュリティの注意点
- ローカルの秘密情報は `.env`（`.env.example` を参照）に置きます。ローカルでは `OPENAI_API_KEY` を使います。
- Cloudflareでは `wrangler secret put OPENAI_API_KEY` で秘密情報を保存します（コミットしない）。
- `.nuxt/` や `.output/` などの生成フォルダはコミットしません。
