// Options page controller — directly reads/writes chrome.storage

const STORAGE_KEY = 'knexio_reader';

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, d => resolve(d[STORAGE_KEY] || {}));
  });
}

function setSettings(updates) {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, d => {
      const current = d[STORAGE_KEY] || {};
      chrome.storage.local.set({ [STORAGE_KEY]: { ...current, ...updates } }, resolve);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadQuota();
  document.getElementById('save-key').addEventListener('click', saveApiKey);
  document.getElementById('save-lang').addEventListener('click', saveLang);
});

async function loadSettings() {
  try {
    const s = await getSettings();
    if (s.userApiKey) document.getElementById('api-key').value = s.userApiKey;
    if (s.targetLang) document.getElementById('default-lang').value = s.targetLang;
  } catch (e) { console.log(e); }
}

async function loadQuota() {
  try {
    const s = await getSettings();
    const display = document.getElementById('quota-display');
    if (s.userApiKey) {
      display.textContent = '无限';
      display.className = 'quota-number';
    } else {
      const today = new Date().toDateString();
      const used = s.quotaDate === today ? (s.quotaUsed || 0) : 0;
      const remaining = 10 - used;
      display.textContent = remaining;
      display.className = `quota-number ${remaining === 0 ? 'empty' : ''}`;
    }
  } catch (e) { console.log(e); }
}

async function saveApiKey() {
  const key = document.getElementById('api-key').value.trim();
  const msg = document.getElementById('save-msg');
  if (key && !key.startsWith('sk-')) {
    msg.textContent = '⚠️ API Key 格式不正确，应以 sk- 开头';
    msg.className = 'error';
    return;
  }
  try {
    await setSettings({ userApiKey: key });
    msg.textContent = '✅ 已保存';
    msg.className = 'success';
    loadQuota();
  } catch (e) {
    msg.textContent = '保存失败';
    msg.className = 'error';
  }
}

async function saveLang() {
  try {
    await setSettings({ targetLang: document.getElementById('default-lang').value });
  } catch (e) { console.log(e); }
}
