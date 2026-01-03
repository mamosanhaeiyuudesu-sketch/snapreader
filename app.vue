<template>
  <div class="page">
    <main class="card">
      <header class="card__header">
        <div>
          <p class="eyebrow">SnapReader</p>
          <h1>画像を送って、数秒で要約。</h1>
        </div>
        <!-- <p class="hint">カメラかファイルから画像を選び、AIで画像を読み込み、内容を要約します。</p> -->
      </header>

      <section class="uploader">
        <label class="upload-label">
          <input
            type="file"
            accept="image/*"
            @change="onFileChange"
          />
          <span>写真を撮る / ファイルを選ぶ</span>
        </label>
        <div v-if="previewUrl" class="preview">
          <img :src="previewUrl" alt="選択した画像のプレビュー" />
        </div>
      </section>

      <section class="actions">
        <button class="primary" :disabled="!imageBase64 || loading" @click="submit">
          {{ loading ? '送信中...' : '要約を依頼する' }}
        </button>
        <button class="ghost" :disabled="loading || !previewUrl" @click="reset">
          リセット
        </button>
      </section>

      <section v-if="error" class="status status--error">
        <p>{{ error }}</p>
      </section>

      <section v-if="summary" class="status status--success">
        <h2>要約</h2>
        <p>{{ summary }}</p>
      </section>

      <section v-if="summary" class="chat">
        <!-- <div class="chat__controls">
          <label class="chat__toggle">
            <input v-model="includeImageInChat" type="checkbox" />
            <span>画像も参照する（遅くなる）</span>
          </label>
        </div> -->
        <div v-if="chatMessages.length" class="chat__log">
          <div
            v-for="(message, index) in chatMessages"
            :key="index"
            class="chat__bubble"
            :class="message.role === 'user' ? 'chat__bubble--user' : 'chat__bubble--assistant'"
          >
            <p>{{ message.content }}</p>
          </div>
        </div>
        <p v-else class="chat__empty">質問を入力すると会話が始まります。</p>
        <form class="chat__form" @submit.prevent="sendChat">
          <textarea
            v-model="chatInput"
            class="chat__input"
            placeholder="質問を入力..."
            :disabled="chatLoading"
            @keydown="onChatKeydown"
          ></textarea>
          <button
            class="primary"
            type="submit"
            :disabled="chatLoading || !chatInput.trim()"
          >
            {{ chatLoading ? '送信中...' : '送信' }}
          </button>
        </form>
        <section v-if="chatError" class="status status--error">
          <p>{{ chatError }}</p>
        </section>
      </section>

      <section v-if="loading" class="status status--info">
        <p>画像を送信しています。少々お待ちください…</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

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

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  error.value = '';
  summary.value = '';

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

  try {
    const response = await $fetch<{ summary: string }>('/api/analyze', {
      method: 'POST',
      body: { imageBase64: imageBase64.value },
    });
    summary.value = response.summary;
  } catch (err: any) {
    const message =
      err?.data?.message || err?.statusMessage || err?.message || '解析に失敗しました。';
    error.value = message;
  } finally {
    loading.value = false;
  }
};

const sendChat = async () => {
  if (!summary.value) {
    chatError.value = '要約がありません。';
    return;
  }

  if (!imageBase64.value) {
    chatError.value = '画像を選択してください。';
    return;
  }

  const question = chatInput.value.trim();
  if (!question || chatLoading.value) return;

  chatLoading.value = true;
  chatError.value = '';

  const nextMessages = [...chatMessages.value, { role: 'user', content: question }];
  const trimmedMessages = nextMessages.slice(-8);
  chatMessages.value = nextMessages;
  chatInput.value = '';

  try {
    const response = await $fetch<{ reply: string }>('/api/chat', {
      method: 'POST',
      body: {
        imageBase64: includeImageInChat.value ? imageBase64.value : undefined,
        summary: summary.value,
        messages: trimmedMessages,
      },
    });
    chatMessages.value = [...nextMessages, { role: 'assistant', content: response.reply }];
  } catch (err: any) {
    const message =
      err?.data?.message || err?.statusMessage || err?.message || '返信の取得に失敗しました。';
    chatError.value = message;
  } finally {
    chatLoading.value = false;
  }
};

const onChatKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return;
  if (!(event.metaKey || event.ctrlKey)) return;

  event.preventDefault();
  sendChat();
};

const reset = () => {
  previewUrl.value = '';
  imageBase64.value = '';
  summary.value = '';
  error.value = '';
  chatMessages.value = [];
  chatInput.value = '';
  chatError.value = '';
};
</script>

<style scoped>
:global(body) {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: radial-gradient(circle at 20% 20%, #0f172a 0, #020617 45%);
  color: #e2e8f0;
}

.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.card {
  width: min(960px, 100%);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  display: grid;
  gap: 16px;
}

.card__header h1 {
  margin: 8px 0 0;
  font-size: clamp(24px, 4vw, 32px);
  color: #f8fafc;
}

.card__header .eyebrow {
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
  color: #93c5fd;
  margin: 0;
}

.card__header .hint {
  color: #cbd5e1;
  margin-top: 4px;
}

.uploader {
  display: grid;
  gap: 10px;
}

.upload-label {
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 14px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #dbeafe;
  background: rgba(255, 255, 255, 0.04);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.upload-label:hover {
  border-color: #93c5fd;
  transform: translateY(-1px);
}

.upload-label input {
  display: none;
}

.preview {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
}

.preview img {
  width: 100%;
  display: block;
  object-fit: contain;
  max-height: 360px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  border: none;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.primary {
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #0b1021;
  font-weight: 700;
  box-shadow: 0 12px 30px rgba(99, 102, 241, 0.35);
}

.primary:not(:disabled):hover {
  transform: translateY(-1px);
}

.ghost {
  background: transparent;
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status {
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.status--success {
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.3);
}

.status--error {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.4);
}

.status--info {
  background: rgba(125, 211, 252, 0.08);
  border-color: rgba(125, 211, 252, 0.4);
}

.chat {
  display: grid;
  gap: 12px;
}

.chat__controls {
  display: flex;
  justify-content: flex-end;
}

.chat__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cbd5f5;
}

.chat__toggle input {
  accent-color: #38bdf8;
}

.chat__header {
  display: grid;
  gap: 4px;
}

.chat__header h2 {
  margin: 0;
  font-size: 20px;
  color: #f8fafc;
}

.chat__hint {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
}

.chat__log {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.35);
  max-height: 320px;
  overflow-y: auto;
}

.chat__bubble {
  padding: 10px 12px;
  border-radius: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.chat__bubble--user {
  justify-self: end;
  background: rgba(56, 189, 248, 0.18);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #e0f2fe;
}

.chat__bubble--assistant {
  justify-self: start;
  background: rgba(148, 163, 184, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #f1f5f9;
}

.chat__empty {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
}

.chat__form {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.chat__input {
  flex: 1;
  min-height: 48px;
  resize: vertical;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #e2e8f0;
  font-size: 14px;
  font-family: inherit;
}

.chat__input:focus {
  outline: 2px solid rgba(56, 189, 248, 0.6);
  outline-offset: 1px;
}

@media (max-width: 640px) {
  .card {
    padding: 22px;
  }

  .actions {
    flex-direction: column;
  }

  .chat__form {
    flex-direction: column;
  }

  button {
    width: 100%;
  }
}
</style>
