type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const extractTextDelta = (payload: any, sentAny: boolean) => {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.delta === 'string') return payload.delta;
  if (typeof payload.text === 'string') {
    if (payload.type?.endsWith?.('.done') && sentAny) return '';
    return payload.text;
  }
  if (typeof payload.output_text === 'string') {
    if (payload.type?.endsWith?.('.done') && sentAny) return '';
    return payload.output_text;
  }
  return '';
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
              'マークダウンは使わず、句点「。」ごとに改行してください。' +
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
        max_output_tokens: 400,
        stream: true,
      }),
    });

    if (response.status === 429) {
      throw createError({
        statusCode: 429,
        statusMessage: '時間を置いて再試行してください。',
      });
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null as any);
      const openAiMessage = data?.error?.message || '返信の取得に失敗しました。';
      throw createError({
        statusCode: response.status || 500,
        statusMessage: openAiMessage,
      });
    }

    if (!response.body) {
      throw createError({
        statusCode: 502,
        statusMessage: '返信のストリームを取得できませんでした。',
      });
    }

    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
    setHeader(event, 'Cache-Control', 'no-cache, no-transform');
    setHeader(event, 'X-Accel-Buffering', 'no');
    setHeader(event, 'Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const res = event.node.res;
    let buffer = '';
    let sentAny = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') {
          res.end();
          return;
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = extractTextDelta(parsed, sentAny);
        if (delta) {
          sentAny = true;
          res.write(delta);
        }
      }
    }

    res.end();
    return;
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
