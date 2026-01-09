export default defineEventHandler(async (event) => {
  const body = await readBody<{ imageBase64?: string }>(event);
  const imageBase64 = body?.imageBase64;

  if (!imageBase64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'imageBase64 is required',
    });
  }

  const { openaiApiKey } = useRuntimeConfig();

  if (!openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API key is not configured.',
    });
  }

  try {
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
              { type: 'input_text', text: '画像内の文章を日本語で全文書き起こししてください。' },
              { type: 'input_image', image_url: imageBase64 },
            ],
          },
        ],
        max_output_tokens: 3000,
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
      const openAiMessage = data?.error?.message || '全文書き起こしに失敗しました。';
      throw createError({
        statusCode: response.status || 500,
        statusMessage: openAiMessage,
      });
    }

    const transcript =
      data?.output_text ||
      data?.output?.[0]?.content?.find?.((chunk: any) => 'text' in chunk)?.text ||
      '';

    if (!transcript) {
      throw createError({
        statusCode: 502,
        statusMessage: '全文書き起こしを取得できませんでした。',
      });
    }

    return { transcript };
  } catch (err: any) {
    if (err?.statusCode && err?.statusMessage) {
      throw err;
    }

    const message = err?.message || '全文書き起こしに失敗しました。';
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
