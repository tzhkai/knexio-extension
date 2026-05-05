// Knexio 阅读伴侣 — options.js

// ── API Key ──
const keyInput = document.getElementById('api-key-input');
const keyStatus = document.getElementById('key-status');
const toggleBtn = document.getElementById('toggle-key');

// Load saved key
chrome.storage.sync.get(['deepseek_api_key'], (items) => {
  if (items.deepseek_api_key) {
    keyInput.value = items.deepseek_api_key;
    keyStatus.textContent = '✅ DeepSeek 已配置 — 摘要功能可用';
    keyStatus.className = 'status ok';
  }
});

// Toggle visibility
toggleBtn.addEventListener('click', () => {
  const isPassword = keyInput.type === 'password';
  keyInput.type = isPassword ? 'text' : 'password';
  toggleBtn.textContent = isPassword ? '🙈' : '👁️';
});

// Save
document.getElementById('save-key').addEventListener('click', () => {
  const key = keyInput.value.trim();
  if (!key) {
    keyStatus.textContent = '请输入 API Key';
    keyStatus.className = 'status warn';
    return;
  }
  if (!key.startsWith('sk-')) {
    keyStatus.textContent = '⚠️ API Key 格式不太对（应该以 sk- 开头），确定要保存吗？再点一次确认';
    keyStatus.className = 'status warn';
    return;
  }
  chrome.storage.sync.set({ deepseek_api_key: key }, () => {
    keyStatus.textContent = '✅ 已保存 — 回到网页试试点插件图标 → 摘要';
    keyStatus.className = 'status ok';
  });
});

// Clear
document.getElementById('clear-key').addEventListener('click', () => {
  chrome.storage.sync.remove('deepseek_api_key', () => {
    keyInput.value = '';
    keyStatus.textContent = '已清除 API Key';
    keyStatus.className = 'status';
  });
});

// ── Default language ──
const langSelect = document.getElementById('default-lang');
chrome.storage.sync.get(['default_lang'], (items) => {
  if (items.default_lang) langSelect.value = items.default_lang;
});

document.getElementById('save-lang').addEventListener('click', () => {
  chrome.storage.sync.set({ default_lang: langSelect.value }, () => {
    alert('默认语言已保存');
  });
});
