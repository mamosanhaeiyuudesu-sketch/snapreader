type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    imageBase64?: string;
    summary?: string;
    messages?: ChatMessage[];
  }>(event);

  const imageBase64 = body?.imageBase64;
  const summary = body?.summary;
  const rawMessages = body?.messages ?? [];

  if (!summary) {
    throw createError({
      statusCode: 400,
      statusMessage: 'summary is required',
    });
  }

  const messages = Array.isArray(rawMessages)
    ? rawMessages.filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string'
    )
    : [];

  if (messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'messages is required',
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
    const input: Array<{ role: string; content: Array<{ type: string; text?: string; image_url?: string }> }> = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'あなたは画像の要約の続きを扱うアシスタントです。' +
              '以下は画像の要約です。\n' +
              summary +
              '\n要約を踏まえて、ユーザーの質問に日本語で簡潔に答えてください。' +
              '画像が提供されている場合は参照して構いません。',
          },
        ],
      },
    ];

    if (imageBase64) {
      input.push({
        role: 'user',
        content: [
          { type: 'input_text', text: '参考画像' },
          { type: 'input_image', image_url: imageBase64 },
        ],
      });
    }

    input.push(
      ...messages.map((message) => ({
        role: message.role,
        content: [{ type: 'input_text', text: message.content }],
      }))
    );

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input,
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
      const openAiMessage = data?.error?.message || '返信の取得に失敗しました。';
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
        statusMessage: '返信を取得できませんでした。',
      });
    }

    return { reply: content };
  } catch (err: any) {
    if (err?.statusCode && err?.statusMessage) {
      throw err;
    }

    const message = err?.message || '返信の取得に失敗しました。';
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
