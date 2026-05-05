// Popup controller — self-contained, no background dependency for core features

const FREE_DAILY_QUOTA = 10;
const STORAGE_KEY = 'knexio_reader';

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('translate-btn').addEventListener('click', doTranslate);
  document.getElementById('copy-translate').addEventListener('click', () => copyText('translate-result'));
  document.getElementById('summarize-btn').addEventListener('click', doSummarize);
  document.getElementById('summarize-page-btn').addEventListener('click', summarizePage);
  document.getElementById('copy-summary').addEventListener('click', () => copyText('summarize-result'));
  document.getElementById('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  loadQuota();
});

// ====== Storage helpers ======

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

// ====== Quota ======

async function loadQuota() {
  try {
    const s = await getSettings();
    const badge = document.getElementById('quota-badge');
    const today = new Date().toDateString();
    if (s.userApiKey) {
      badge.textContent = '🔑 自己的 Key';
      badge.style.color = '#4ade80';
      return;
    }
    if (s.quotaDate !== today) {
      await setSettings({ quotaUsed: 0, quotaDate: today });
      badge.textContent = '剩余 10 次';
      badge.style.color = '#a0a0c0';
      return;
    }
    const used = s.quotaUsed || 0;
    const remaining = FREE_DAILY_QUOTA - used;
    badge.textContent = `剩余 ${remaining} 次`;
    badge.style.color = remaining <= 3 ? '#fbbf24' : '#a0a0c0';
  } catch (e) {
    console.log('quota load error', e);
  }
}

async function checkQuota() {
  const s = await getSettings();
  const today = new Date().toDateString();
  if (s.userApiKey) return { ok: true, hasKey: true };
  if (s.quotaDate !== today) {
    await setSettings({ quotaUsed: 0, quotaDate: today });
    return { ok: true, hasKey: false, remaining: FREE_DAILY_QUOTA };
  }
  const used = s.quotaUsed || 0;
  return { ok: used < FREE_DAILY_QUOTA, hasKey: false, remaining: Math.max(0, FREE_DAILY_QUOTA - used) };
}

async function useQuota() {
  const s = await getSettings();
  await setSettings({ quotaUsed: (s.quotaUsed || 0) + 1, quotaDate: new Date().toDateString() });
}

// ====== Translate (direct API call, no background needed) ======

function detectLanguage(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  return cjk / Math.max(text.length, 1) > 0.3 ? 'zh' : 'en';
}

async function translateText(text, targetLang) {
  const sourceLang = detectLanguage(text);
  if (sourceLang === targetLang) return { translated: text, source: sourceLang };
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data || !data[0]) throw new Error('翻译失败');
  const translated = data[0].filter(p => p && p[0]).map(p => p[0]).join('');
  return { translated, source: data[2] || sourceLang };
}

async function doTranslate() {
  const input = document.getElementById('translate-input').value.trim();
  if (!input) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || ''
        });
        if (result) { document.getElementById('translate-input').value = result; return doTranslate(); }
      }
    } catch (e) {}
    showError('translate-result', '请先输入文本或选中网页文字');
    return;
  }
  const targetLang = document.getElementById('target-lang').value;
  const resultEl = document.getElementById('translate-result');
  resultEl.textContent = '翻译中...';
  resultEl.classList.add('loading');
  try {
    const result = await translateText(input, targetLang);
    if (result.error) { showError('translate-result', result.error); return; }
    resultEl.classList.remove('loading');
    resultEl.textContent = result.translated;
    const lmap = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어' };
    document.getElementById('translate-source').textContent = `检测语言: ${lmap[result.source] || result.source}`;
  } catch (e) {
    showError('translate-result', '翻译失败: ' + e.message);
  }
}

// ====== Summarize ======

async function summarizeLocal(text, style) {
  const lang = detectLanguage(text);
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
  const keywords = ['重要', '关键', '核心', '结论', '因此', '所以', '建议',
    'important', 'key', 'conclusion', 'therefore', 'recommend', 'result',
    '数据显示', '分析', '指出', '认为', 'data', 'shows', 'indicates'];
  const scored = sentences.map((s, i) => {
    let score = keywords.filter(kw => s.toLowerCase().includes(kw.toLowerCase())).length;
    if (i === 0 || i === sentences.length - 1) score += 1;
    if (s.length > 30) score += 0.5;
    return { text: s.trim(), score };
  });
  const top = scored.filter(s => s.text.length > 10)
    .sort((a, b) => b.score - a.score).slice(0, 5);
  let summary = top.map(s => s.text).join('\n');
  if (lang === 'en' && summary) {
    try {
      const tr = await translateText(summary, 'zh');
      summary = tr.translated;
    } catch (e) {}
  }
  return { summary: summary || '未能提取摘要（内容过短或无关键信息）', method: '本地提取' };
}

async function summarizeWithDeepSeek(text, apiKey, style) {
  const prompt = style === 'detailed'
    ? `请用中文对以下内容进行详细摘要，保留关键数据和观点：\n\n${text}`
    : `请用中文简要总结以下内容的核心要点（3-5句话）：\n\n${text}`;
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.3 })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 错误: ${resp.status}`);
  }
  const result = await resp.json();
  return { summary: result.choices?.[0]?.message?.content || '摘要生成失败', method: '🤖 DeepSeek' };
}

async function doSummarize() {
  const input = document.getElementById('summarize-input').value.trim();
  if (!input) { showError('summarize-result', '请先输入文本或点击「摘要页面」'); return; }
  const style = document.querySelector('input[name="summary-style"]:checked')?.value || 'concise';
  const s = await getSettings();
  const quota = await checkQuota();
  const resultEl = document.getElementById('summarize-result');
  resultEl.textContent = '摘要中...';
  resultEl.classList.add('loading');
  try {
    const truncated = input.length > (s.userApiKey ? 6000 : 3000) ? input.substring(0, s.userApiKey ? 6000 : 3000) + '...' : input;
    let result;
    if (s.userApiKey) {
      result = await summarizeWithDeepSeek(truncated, s.userApiKey, style);
    } else {
      if (!quota.ok) { showError('summarize-result', '今日免费额度已用完，请在设置中填入API Key或明天再来。'); return; }
      result = await summarizeLocal(truncated, style);
      await useQuota();
    }
    resultEl.classList.remove('loading');
    resultEl.textContent = result.summary;
    document.getElementById('summary-method').textContent = result.method;
    loadQuota();
  } catch (e) {
    showError('summarize-result', '摘要失败: ' + e.message);
  }
}

async function summarizePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const main = document.querySelector('main, article, .content, .post, #content') || document.body;
        const clone = main.cloneNode(true);
        clone.querySelectorAll('script, style, nav, footer, header, .sidebar, .nav, .menu, noscript').forEach(el => el.remove());
        return clone.innerText.substring(0, 8000);
      }
    });
    if (result) { document.getElementById('summarize-input').value = result; return doSummarize(); }
  } catch (e) {
    showError('summarize-result', '无法读取页面内容');
  }
}

// ====== Helpers ======

function showError(id, msg) {
  const el = document.getElementById(id);
  el.classList.remove('loading');
  el.innerHTML = `<span style="color:#ef4444">⚠️ ${msg}</span>`;
}

function copyText(id) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).catch(() => {});
}
