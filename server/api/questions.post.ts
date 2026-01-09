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
                  '以下の全文書き起こしを基に、次に聞くと良い質問を日本語で3つ作ってください。' +
                  '質問は各20文字程度のシンプルな日本語で、出力はJSON配列のみです。\n\n' +
                  transcript,
              },
            ],
          },
        ],
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
