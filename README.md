# SnapReader (Nuxt 3)

画像をアップロードまたは撮影して OpenAI で要約するシンプルな Nuxt 3 アプリです。Cloudflare Workers へのデプロイ設定付き。

## セットアップ

- Node.js 18+ を想定。
- 依存インストール: `npm install`
- 環境変数: `.env` を作成して `OPENAI_API_KEY=` を設定（テンプレは `.env.example`）。

## 開発

- ローカル起動: `npm run dev`
- ブラウザでアプリを開き、画像を選択すると Base64 化され `/api/analyze` に送信されます。
- サーバールート: `server/api/analyze.post.ts` が OpenAI API (`gpt-4.1`, `max_tokens: 256`) を呼び出し、要約を返します。

## 動作確認

1) `.env` に `OPENAI_API_KEY` をセット。  
2) `npm run dev` で起動。  
3) 画像をアップロードまたはカメラで撮影し、「要約を依頼する」を押下。  
4) 要約がカード内に表示されること、エラー時にメッセージが出ることを確認。

## Cloudflare Workers デプロイ

- Nitro は `preset: 'cloudflare'`。ビルドで `.output/server/index.mjs` を生成し、Wrangler でデプロイします。
- シークレット登録: `wrangler secret put OPENAI_API_KEY`
- ビルド: `npm run build`
- デプロイ: `wrangler deploy`

`wrangler.toml` で `compatibility_date` や `name` は適宜変更可能です。`[vars]` には秘密鍵を置かず、シークレットで管理してください。
