export default defineEventHandler(async (event) => {
  const body = await readBody<{ transcript?: string }>(event);
  const transcript = body?.transcript;

  if (!transcript) {
    throw createError({
      statusCode: 400,
      statusMessage: 'transcript is required',
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
              {
                type: 'input_text',
                text:
                  '以下の全文書き起こしを基に、日本語で要約してください。' +
                  'マークダウンは使わず、句点「。」ごとに改行してください。\n\n' +
                  transcript,
              },
            ],
          },
        ],
        max_output_tokens: 800,
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
      const openAiMessage = data?.error?.message || '要約に失敗しました。';
      throw createError({
        statusCode: response.status || 500,
        statusMessage: openAiMessage,
      });
    }

    const summary =
      data?.output_text ||
      data?.output?.[0]?.content?.find?.((chunk: any) => 'text' in chunk)?.text ||
      '';

    if (!summary) {
      throw createError({
        statusCode: 502,
        statusMessage: '要約を取得できませんでした。',
      });
    }

    return { summary };
  } catch (err: any) {
    if (err?.statusCode && err?.statusMessage) {
      throw err;
    }

    const message = err?.message || '要約に失敗しました。';
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
