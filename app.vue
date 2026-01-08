<template>
  <v-app>
    <v-main class="app-shell">
      <v-container class="py-8">
        <v-row justify="center">
          <v-col cols="12" md="10" lg="8">
            <v-card class="app-card" elevation="8">
              <v-card-title class="pb-0">
                <div class="text-overline text-indigo-lighten-2">SnapReader</div>
                <div class="text-h5 text-sm-h4 font-weight-semibold">
                  画像を送って、数秒で要約
                </div>
                <div class="text-body-2 text-medium-emphasis mt-2">
                  カメラまたはファイルから画像を選択し、内容を要約します。
                </div>
              </v-card-title>

              <v-card-text>
                <v-file-input
                  v-model="selectedFile"
                  accept="image/*"
                  label="写真を撮る / ファイルを選ぶ"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon=""
                  clearable
                  @update:modelValue="onFilePicked"
                />

                <v-img
                  v-if="previewUrl"
                  :src="previewUrl"
                  class="preview mt-4"
                  max-height="320"
                  cover
                />

                <div class="d-flex flex-wrap ga-2 mt-4">
                  <v-btn
                    color="primary"
                    :loading="loading"
                    :disabled="!imageBase64 || loading"
                    @click="submit"
                  >
                    {{ loading ? '送信中...' : '要約を依頼する' }}
                  </v-btn>
                  <v-btn variant="outlined" :disabled="loading || !previewUrl" @click="reset">
                    リセット
                  </v-btn>
                </div>

                <v-alert v-if="error" class="mt-4" type="error" variant="tonal" border="start">
                  {{ error }}
                </v-alert>

                <v-alert
                  v-if="summary"
                  class="mt-4"
                  type="success"
                  variant="tonal"
                  border="start"
                >
                  <div class="text-subtitle-1 font-weight-semibold mb-2">要約</div>
                  <div class="summary-text">{{ summary }}</div>
                </v-alert>

                <v-alert v-if="loading" class="mt-4" type="info" variant="tonal" border="start">
                  画像を送信しています。少々お待ちください…
                </v-alert>
              </v-card-text>
            </v-card>

            <v-card v-if="summary" class="app-card mt-6 chat-card" elevation="4">
              <v-card-title class="pb-2">
                <div class="text-h6">チャット</div>
                <div class="text-body-2 text-medium-emphasis">要約について続けて質問できます。</div>
              </v-card-title>
              <v-card-text class="chat-body">
                <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
                  <div class="text-body-2 text-medium-emphasis">
                    この画像を深掘りする質問
                  </div>
                  <v-switch
                    v-model="includeImageInChat"
                    inset
                    density="compact"
                    label="画像も参照する"
                    hide-details
                  />
                </div>

                <div v-if="suggestedQuestions.length" class="mb-4">
                  <v-chip
                    v-for="(question, index) in suggestedQuestions"
                    :key="index"
                    class="ma-1"
                    variant="tonal"
                    color="primary"
                    :disabled="chatLoading || suggestionsLoading"
                    @click="onSuggestionClick(question)"
                  >
                    {{ question }}
                  </v-chip>
                </div>
                <div v-else class="text-body-2 text-medium-emphasis mb-4">
                  {{ suggestionsLoading ? '提案を生成中…' : '質問候補はありません。' }}
                </div>
                <div v-if="suggestionsError" class="text-body-2 text-error mb-4">
                  {{ suggestionsError }}
                </div>

                <div v-if="chatMessages.length" class="chat-log">
                  <div
                    v-for="(message, index) in chatMessages"
                    :key="index"
                    class="chat-row"
                    :class="message.role === 'user' ? 'chat-row--user' : 'chat-row--assistant'"
                  >
                    <div
                      class="chat-bubble"
                      :class="message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'"
                    >
                      <span>{{ message.content }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="text-body-2 text-medium-emphasis mb-4">
                  質問を入力すると会話が始まります。
                </div>

                <div class="chat-input-bar">
                  <v-textarea
                    v-model="chatInput"
                    label="質問を入力"
                    variant="outlined"
                    rows="2"
                    auto-grow
                    hide-details
                    :disabled="chatLoading"
                    @keydown="onChatKeydown"
                  />
                  <v-btn
                    color="primary"
                    :loading="chatLoading"
                    :disabled="chatLoading || !chatInput.trim()"
                    @click="sendChat"
                  >
                    送信
                  </v-btn>
                </div>

                <v-alert v-if="chatError" class="mt-4" type="error" variant="tonal" border="start">
                  {{ chatError }}
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string>('');
const imageBase64 = ref<string>('');
const summary = ref<string>('');
const error = ref<string>('');
const loading = ref(false);
const chatMessages = ref<ChatMessage[]>([]);
const chatInput = ref('');
const chatLoading = ref(false);
const chatError = ref('');
const includeImageInChat = ref(false);
const suggestedQuestions = ref<string[]>([]);
const suggestionsLoading = ref(false);
const suggestionsError = ref('');

const formatText = (text: string) => {
  const withoutBlocks = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```/g, '')
  );
  const withoutMarkdown = withoutBlocks
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/^\s*#+\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[`*_~]/g, '');
  return withoutMarkdown.replace(/。/g, '。\n').trim();
};

const normalizeQuestion = (question: string) =>
  formatText(question).replace(/\s+/g, ' ').trim();

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });

const onFilePicked = async (fileOrFiles: File | File[] | null) => {
  const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;

  if (!file) {
    previewUrl.value = '';
    imageBase64.value = '';
    return;
  }

  error.value = '';
  summary.value = '';
  chatMessages.value = [];
  chatInput.value = '';
  chatError.value = '';
  suggestedQuestions.value = [];
  suggestionsError.value = '';

  if (!file.type.startsWith('image/')) {
    error.value = '画像ファイルを選択してください。';
    return;
  }

  try {
    const dataUrl = await toDataUrl(file);
    previewUrl.value = dataUrl;
    imageBase64.value = dataUrl;
  } catch (err) {
    error.value = (err as Error).message;
  }
};

const updateSuggestions = async (contextMessages: ChatMessage[]) => {
  if (!summary.value) return;

  suggestionsLoading.value = true;
  suggestionsError.value = '';

  try {
    const response = await $fetch<{ questions: string[] }>('/api/suggest', {
      method: 'POST',
      body: {
        summary: summary.value,
        messages: contextMessages.slice(-6),
      },
    });
    suggestedQuestions.value = (response?.questions ?? [])
      .map((question) => normalizeQuestion(question))
      .filter(Boolean)
      .slice(0, 3);
  } catch (err: any) {
    const message =
      err?.data?.message ||
      err?.statusMessage ||
      err?.message ||
      '質問候補の取得に失敗しました。';
    suggestionsError.value = message;
  } finally {
    suggestionsLoading.value = false;
  }
};

const submit = async () => {
  if (!imageBase64.value) {
    error.value = '画像を選択してください。';
    return;
  }

  loading.value = true;
  error.value = '';
  summary.value = '';
  chatMessages.value = [];
  chatInput.value = '';
  chatError.value = '';
  suggestedQuestions.value = [];
  suggestionsError.value = '';

  try {
    const response = await $fetch<{ summary: string }>('/api/analyze', {
      method: 'POST',
      body: { imageBase64: imageBase64.value },
    });
    summary.value = formatText(response.summary);
    await updateSuggestions([]);
  } catch (err: any) {
    const message =
      err?.data?.message || err?.statusMessage || err?.message || '解析に失敗しました。';
    error.value = message;
  } finally {
    loading.value = false;
  }
};

const sendChat = async (overrideQuestion?: string) => {
  if (!summary.value) {
    chatError.value = '要約がありません。';
    return;
  }

  if (!imageBase64.value) {
    chatError.value = '画像を選択してください。';
    return;
  }

  const question = (overrideQuestion ?? chatInput.value).trim();
  if (!question || chatLoading.value) return;

  chatLoading.value = true;
  chatError.value = '';

  const nextMessages: ChatMessage[] = [
    ...chatMessages.value,
    { role: 'user', content: question },
  ];
  const trimmedMessages = nextMessages.slice(-8);
  chatMessages.value = [...nextMessages, { role: 'assistant', content: '' }];
  const assistantIndex = chatMessages.value.length - 1;
  let assistantRaw = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: includeImageInChat.value ? imageBase64.value : undefined,
        summary: summary.value,
        messages: trimmedMessages,
      }),
    });

    if (!response.ok) {
      let message = '返信の取得に失敗しました。';
      try {
        const data = await response.json();
        message = data?.message || data?.statusMessage || message;
      } catch {
        const text = await response.text();
        if (text) message = text;
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('返信のストリームを取得できませんでした。');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        assistantRaw += decoder.decode(value, { stream: true });
        chatMessages.value[assistantIndex].content = formatText(assistantRaw);
      }
    }

    assistantRaw += decoder.decode();
    chatMessages.value[assistantIndex].content = formatText(assistantRaw);
    await updateSuggestions(chatMessages.value);
  } catch (err: any) {
    const message =
      err?.data?.message || err?.statusMessage || err?.message || '返信の取得に失敗しました。';
    chatError.value = message;
  } finally {
    chatInput.value = '';
    chatLoading.value = false;
  }
};

const onChatKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return;
  if (!(event.metaKey || event.ctrlKey)) return;

  event.preventDefault();
  sendChat();
};

const onSuggestionClick = (question: string) => {
  chatInput.value = question;
  sendChat(question);
};

const reset = () => {
  selectedFile.value = null;
  previewUrl.value = '';
  imageBase64.value = '';
  summary.value = '';
  error.value = '';
  chatMessages.value = [];
  chatInput.value = '';
  chatError.value = '';
  suggestedQuestions.value = [];
  suggestionsError.value = '';
};
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, #0f172a 0, #020617 45%);
}

.app-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(10px);
  width: 100%;
}

.preview {
  border-radius: 12px;
  overflow: hidden;
}

.summary-text {
  white-space: pre-wrap;
}

.chat-card {
  position: relative;
}

.chat-body {
  display: grid;
  gap: 16px;
}

.chat-log {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(2, 6, 23, 0.7);
  max-height: 360px;
  overflow-y: auto;
  overflow-x: hidden;
}

.chat-row {
  display: flex;
  max-width: 100%;
}

.chat-row--user {
  justify-content: flex-end;
}

.chat-row--assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: min(80%, 520px);
  padding: 12px 14px;
  border-radius: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
}

.chat-bubble--user {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.28), rgba(99, 102, 241, 0.35));
  border: 1px solid rgba(56, 189, 248, 0.5);
  color: #e6f6ff;
}

.chat-bubble--assistant {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #f8fafc;
}

.chat-input-bar {
  display: grid;
  gap: 10px;
}

.chat-card :deep(.v-chip) {
  max-width: 100%;
  white-space: normal;
}

@media (min-width: 900px) {
  .chat-input-bar {
    grid-template-columns: 1fr auto;
    align-items: end;
  }
}

@media (max-width: 600px) {
  .app-shell {
    padding: 12px 0;
  }

  .app-card {
    border-radius: 14px;
  }

  .chat-log {
    padding: 12px;
    max-height: 300px;
  }

  .chat-bubble {
    max-width: 92%;
    border-radius: 14px;
  }

  .chat-input-bar {
    grid-template-columns: 1fr;
  }
}
</style>
