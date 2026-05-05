// Background service worker — only handles right-click context menus
// Popup is fully self-contained

const FREE_DAILY_QUOTA = 10;
const STORAGE_KEY = 'knexio_reader';

try {

chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'translate-selection', title: '🌐 翻译选中文本', contexts: ['selection'] });
      chrome.contextMenus.create({ id: 'summarize-selection', title: '📝 AI 摘要选中文本', contexts: ['selection'] });
      chrome.contextMenus.create({ id: 'summarize-page', title: '📝 摘要整个页面', contexts: ['page'] });
    });
  } catch (e) {}
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  try {
    if (info.menuItemId === 'translate-selection') {
      doContextTranslate(info.selectionText, tab.id);
    } else if (info.menuItemId === 'summarize-selection') {
      doContextSummarize(info.selectionText, tab.id);
    } else if (info.menuItemId === 'summarize-page') {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const main = document.querySelector('main, article, .content, #content') || document.body;
          const clone = main.cloneNode(true);
          clone.querySelectorAll('script, style, nav, footer, header, noscript').forEach(el => el.remove());
          return clone.innerText.substring(0, 8000);
        }
      }).then(([r]) => { if (r?.result) doContextSummarize(r.result, tab.id); });
    }
  } catch (e) {}
});

// ====== Context actions ======

async function doContextTranslate(text, tabId) {
  const lang = detectLanguage(text);
  if (lang === 'zh') {
    injectPanel(tabId, '🌐 翻译结果', text, text);
    return;
  }
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const translated = data[0].filter(p => p && p[0]).map(p => p[0]).join('');
    injectPanel(tabId, '🌐 翻译结果', translated, text.substring(0, 200));
  } catch (e) {
    injectPanel(tabId, '⚠️ 错误', '翻译失败: ' + e.message);
  }
}

async function doContextSummarize(text, tabId) {
  const s = await getSettings();
  const quota = await checkQuota(s);
  if (!s.userApiKey && !quota.ok) {
    injectPanel(tabId, '⚠️ 错误', '今日免费额度已用完，请在设置中填入API Key或明天再来。');
    return;
  }
  try {
    const maxLen = s.userApiKey ? 6000 : 3000;
    const truncated = text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    let result;
    if (s.userApiKey) {
      result = await summarizeDeepSeek(truncated, s.userApiKey);
    } else {
      result = await summarizeLocal(truncated);
      await useQuota(s);
    }
    injectPanel(tabId, '📝 AI 摘要', result.summary);
  } catch (e) {
    injectPanel(tabId, '⚠️ 错误', '摘要失败: ' + e.message);
  }
}

function injectPanel(tabId, title, result, original) {
  const escapedResult = result.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inner = original
    ? `<div class="knexio-original">${original.replace(/</g, '&lt;')}${original.length > 200 ? '...' : ''}</div><div class="knexio-result">${escapedResult}</div>`
    : `<div class="knexio-result">${escapedResult}</div>`;
  const html = `<div id="knexio-panel" style="position:fixed;bottom:20px;right:20px;width:380px;max-height:400px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;font-size:13px;color:#e0e0e0;overflow:hidden;animation:knexio-in 0.25s ease-out"><style>@keyframes knexio-in{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}.knexio-original{font-size:12px;color:#666;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #2a2a4a}.knexio-result{white-space:pre-wrap;word-break:break-word}</style><div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#16213e;border-bottom:1px solid #2a2a4a;font-weight:600"><span>${title}</span><button onclick="this.closest('#knexio-panel').remove()" style="background:none;border:none;color:#666;font-size:16px;cursor:pointer;padding:2px 6px;border-radius:4px">✕</button></div><div style="padding:12px;max-height:280px;overflow-y:auto;line-height:1.6">${inner}</div><div style="padding:4px 12px 8px;display:flex;gap:8px"><button onclick="navigator.clipboard.writeText(document.querySelector('#knexio-panel .knexio-result').textContent)" style="font-size:12px;padding:3px 8px;background:#2a2a4a;border:none;border-radius:4px;color:#a0a0c0;cursor:pointer">📋 复制</button></div></div><script>setTimeout(()=>{const p=document.getElementById('knexio-panel');if(p)p.remove()},30000)</script>`;
  chrome.scripting.executeScript({
    target: { tabId },
    func: (h) => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d.firstElementChild); },
    args: [html]
  }).catch(() => {});
  setTimeout(() => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => { const p = document.getElementById('knexio-panel'); if (p) p.remove(); }
    }).catch(() => {});
  }, 30000);
}

// ====== Core functions ======

function detectLanguage(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  return cjk / Math.max(text.length, 1) > 0.3 ? 'zh' : 'en';
}

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, d => resolve(d[STORAGE_KEY] || {}));
  });
}

async function checkQuota(s) {
  const today = new Date().toDateString();
  if (s.userApiKey) return { ok: true, hasKey: true };
  if (s.quotaDate !== today) return { ok: true, hasKey: false };
  return { ok: (s.quotaUsed || 0) < FREE_DAILY_QUOTA, hasKey: false };
}

async function useQuota(s) {
  s.quotaUsed = (s.quotaUsed || 0) + 1;
  s.quotaDate = new Date().toDateString();
  await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: s }, resolve));
}

async function summarizeLocal(text) {
  const lang = detectLanguage(text);
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
  const keywords = ['重要', '关键', '核心', '结论', '因此', '所以', '建议', 'important', 'key', 'conclusion', 'therefore', 'recommend', 'result'];
  const scored = sentences.map((s, i) => {
    let score = keywords.filter(kw => s.toLowerCase().includes(kw.toLowerCase())).length;
    if (i === 0 || i === sentences.length - 1) score += 1;
    if (s.length > 30) score += 0.5;
    return { text: s.trim(), score };
  });
  const top = scored.filter(s => s.text.length > 10).sort((a, b) => b.score - a.score).slice(0, 5);
  let summary = top.map(s => s.text).join('\n');
  if (lang === 'en' && summary) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&dt=t&q=${encodeURIComponent(summary)}`;
      const resp = await fetch(url);
      const data = await resp.json();
      summary = data[0].filter(p => p && p[0]).map(p => p[0]).join('');
    } catch (e) {}
  }
  return { summary: summary || '未能提取摘要', method: '本地提取' };
}

async function summarizeDeepSeek(text, apiKey) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `请用中文简要总结以下内容的核心要点（3-5句话）：\n\n${text}` }],
      max_tokens: 500, temperature: 0.3
    })
  });
  if (!resp.ok) throw new Error('DeepSeek API 错误');
  const data = await resp.json();
  return { summary: data.choices?.[0]?.message?.content || '摘要失败', method: 'DeepSeek' };
}

} catch (e) { console.log('Knexio bg init:', e.message); }

console.log('Knexio background ready');
