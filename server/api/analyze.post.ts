import type { FetchError } from 'ofetch';

type OpenAIResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
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

  const config = useRuntimeConfig();
  const apiKey = config.openaiApiKey;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API key is not configured.',
    });
  }

  try {
    const response = await $fetch<OpenAIResponse>('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: 'gpt-4.1',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Summarize this image in Japanese.' },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
        max_tokens: 256,
      },
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content) {
      throw createError({
        statusCode: 502,
        statusMessage: '解析結果を取得できませんでした。',
      });
    }

    return { summary: content };
  } catch (err: any) {
    const fetchErr = err as FetchError;
    const statusCode = fetchErr?.response?.status;

    if (statusCode === 429) {
      throw createError({
        statusCode: 429,
        statusMessage: '時間を置いて再試行してください。',
      });
    }

    const openAiMessage =
      (fetchErr?.data as any)?.error?.message ||
      fetchErr?.message ||
      '画像の解析に失敗しました。';

    throw createError({
      statusCode: statusCode || 500,
      statusMessage: openAiMessage,
    });
  }
});
