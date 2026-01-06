type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const parseQuestions = (text: string) => {
  if (!text) return [];

  const withoutBlocks = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```/g, '')
  );

  try {
    const parsed = JSON.parse(withoutBlocks);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // Fall back to line parsing.
  }

  return withoutBlocks.split(/\r?\n/);
};

const normalizeQuestion = (question: string) =>
  question
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^[「『"'`]+/, '')
    .replace(/[」』"'`]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    summary?: string;
    messages?: ChatMessage[];
  }>(event);

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

  const historyText = messages
    .map((message) => `${message.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${message.content}`)
    .join('\n');

  const { openaiApiKey } = useRuntimeConfig();

  if (!openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI API key is not configured.',
    });
  }

  try {
    const input = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'あなたは画像要約を深掘りする質問を提案するアシスタントです。' +
              '次に聞くと良い質問を日本語で3つ提案してください。' +
              '出力はJSON配列のみで、番号や箇条書きは不要です。',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `要約:\n${summary}`,
          },
        ],
      },
    ];

    if (historyText) {
      input.push({
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `これまでの会話:\n${historyText}`,
          },
        ],
      });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input,
        max_output_tokens: 200,
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
      const openAiMessage = data?.error?.message || '質問候補の取得に失敗しました。';
      throw createError({
        statusCode: response.status || 500,
        statusMessage: openAiMessage,
      });
    }

    const text =
      data?.output_text ||
      data?.output?.[0]?.content?.find?.((chunk: any) => 'text' in chunk)?.text ||
      '';

    const questions = parseQuestions(text)
      .map((question) => normalizeQuestion(question))
      .filter(Boolean)
      .slice(0, 3);

    if (questions.length === 0) {
      throw createError({
        statusCode: 502,
        statusMessage: '質問候補を取得できませんでした。',
      });
    }

    return { questions };
  } catch (err: any) {
    if (err?.statusCode && err?.statusMessage) {
      throw err;
    }

    const message = err?.message || '質問候補の取得に失敗しました。';
    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }
});
