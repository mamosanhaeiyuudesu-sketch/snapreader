const CACHE_TTL_MS = 60 * 60 * 72; // 72時間
const cache = new Map<string, { summary: string; expiresAt: number }>();

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}-${value.length}`;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<{ imageBase64?: string }>(event);
  const imageBase64 = body?.imageBase64;

  if (!imageBase64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'imageBase64 is required',
    });
  }

  const { openaiApiKey } = useRuntimeConfig()

  if (!openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API key is not configured.',
    });
  }

  try {
    const cacheKey = hashString(imageBase64);
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      setHeader(event, 'X-Cache', 'HIT');
      return { summary: cached.summary };
    }
    if (cached && cached.expiresAt <= now) {
      cache.delete(cacheKey);
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  '日本語で要約して。マークダウンは使わず、句点「。」ごとに改行して。',
              },
              // Responses API expects `input_image` with a string URL (data URL works).
              { type: 'input_image', image_url: imageBase64 },
            ],
          },
        ],
        max_output_tokens: 1000,
      }),
    });

    if (response.status === 429) {
      throw createError({
        statusCode: 429,
        statusMessage: '時間を置いて再試行してください。',
      });
    }

    const data = await response.json().catch(() => null as any);

    if (!response.ok) {
      const openAiMessage = data?.error?.message || '画像の解析に失敗しました。';
      throw createError({
        statusCode: response.status || 500,
        statusMessage: openAiMessage,
      });
    }

    const content =
      data?.output_text ||
      data?.output?.[0]?.content?.find?.((chunk: any) => 'text' in chunk)?.text;

    if (!content) {
      throw createError({
        statusCode: 502,
        statusMessage: '解析結果を取得できませんでした。',
      });
    }

    cache.set(cacheKey, { summary: content, expiresAt: now + CACHE_TTL_MS });
    return { summary: content };
  } catch (err: any) {
    if (err?.statusCode && err?.statusMessage) {
      throw err;
    }

    const message = err?.message || '画像の解析に失敗しました。';
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
