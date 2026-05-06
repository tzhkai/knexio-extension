// Knexio 阅读伴侣 — options.js

// Apply i18n
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = I18N.t(el.dataset.i18n);
  });
  document.title = I18N.t('options_title');
}
applyI18n();

// ── API Key ──
const keyInput = document.getElementById('api-key-input');
const keyStatus = document.getElementById('key-status');
const saveKeyBtn = document.getElementById('save-key');
const clearKeyBtn = document.getElementById('clear-key');

// Load saved key
chrome.storage.sync.get(['deepseek_api_key'], (items) => {
  if (items.deepseek_api_key) {
    keyInput.value = items.deepseek_api_key;
  }
});

saveKeyBtn.addEventListener('click', () => {
  const key = keyInput.value.trim();
  if (!key) {
    keyStatus.textContent = I18N.t('options_enter_key') || '请输入 API Key';
    keyStatus.className = 'status warn';
    return;
  }
  chrome.storage.sync.set({ deepseek_api_key: key }, () => {
    keyStatus.textContent = I18N.t('options_saved');
    keyStatus.className = 'status ok';
  });
});

clearKeyBtn.addEventListener('click', () => {
  chrome.storage.sync.remove('deepseek_api_key', () => {
    keyInput.value = '';
    keyStatus.textContent = I18N.t('options_saved');
    keyStatus.className = 'status ok';
  });
});

// ── Default Language ──
const langSelect = document.getElementById('default-lang');
const saveLangBtn = document.getElementById('save-lang');

chrome.storage.sync.get(['default_lang'], (items) => {
  if (items.default_lang) langSelect.value = items.default_lang;
});

saveLangBtn.addEventListener('click', () => {
  chrome.storage.sync.set({ default_lang: langSelect.value }, () => {
    keyStatus.textContent = I18N.t('options_saved');
    keyStatus.className = 'status ok';
  });
});
