// Knexio 阅读伴侣 — background.js (service worker)

// ── Context menu: translate selection ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '🔤 翻译选中文字',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'summarize-page',
    title: '✂️ 智能摘句（本页）',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    handleTranslateSelection(info.selectionText, tab);
  }
  if (info.menuItemId === 'summarize-page') {
    handleSummarizePage(tab);
  }
});

async function handleTranslateSelection(text, tab) {
  try {
    // Detect language first
    const detectRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text.substring(0, 100))}`
    );
    const detectData = await detectRes.json();
    const srcLang = detectData[2] || 'auto';
    
    // Auto-detect target: if source is Chinese, translate to English; otherwise to Chinese
    const targetLang = srcLang === 'zh-CN' ? 'en' : 'zh-CN';
    
    // Full translation
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    const translated = data[0].map(x => x[0]).join('');
    
    // Inject result into page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showTranslationPopup,
      args: [translated, targetLang === 'en' ? 'English' : '中文']
    });
  } catch (e) {
    console.error('Translation error:', e);
  }
}

// This function runs in the page context
function showTranslationPopup(text, langLabel) {
  const existing = document.getElementById('knexio-translate-popup');
  if (existing) existing.remove();
  
  // Try to position near the current selection
  const sel = window.getSelection();
  const popupW = 420;
  let top, left;
  
  if (sel && sel.rangeCount > 0) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    
    left = Math.max(8, Math.min(vw - popupW - 8, rect.left + rect.width / 2 - popupW / 2));
    
    // Show below selection if space; otherwise above
    if (vh - rect.bottom - gap > 120) {
      top = rect.bottom + gap;
    } else {
      top = Math.max(8, rect.top - gap);
    }
  } else {
    // Fallback: center of viewport
    top = window.innerHeight * 0.3;
    left = Math.max(8, window.innerWidth / 2 - popupW / 2);
  }
  
  const popup = document.createElement('div');
  popup.id = 'knexio-translate-popup';
  popup.innerHTML = `
    <div style="
      position: fixed; z-index: 2147483647;
      top: ${top}px;
      left: ${left}px;
      width: ${popupW}px;
      max-height: 280px; overflow-y: auto;
      background: #1a1a2e; color: #e0e0e0;
      padding: 14px 16px; border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6;
      border: 1px solid #2a2a3e;
    ">
      <div style="margin-bottom:8px">
        <span style="font-size:11px;color:#888">翻译为 ${langLabel}</span>
      </div>
      <button id="knexio-close-popup" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#888;cursor:pointer;font-size:14px;line-height:1">✕</button>
      <div>${text.replace(/\n/g, '<br>')}</div>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('knexio-close-popup').onclick = () => popup.remove();
  setTimeout(() => { if (document.getElementById('knexio-translate-popup')) popup.remove(); }, 15000);
}

// ── Summarize page (context menu) ──
async function handleSummarizePage(tab) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractAndShowSummary
    });
  } catch (e) {
    console.error('Summary error:', e);
  }
}

// Runs in page context — extracts paragraphs, scores, picks key sentences
function extractAndShowSummary() {
  const existing = document.getElementById('knexio-summary-popup');
  if (existing) existing.remove();
  
  const title = document.title || '';
  const article = document.querySelector('article') || document.querySelector('main') || document.body;
  const paragraphs = Array.from(article.querySelectorAll('p')).map(p => p.innerText.trim()).filter(t => t.length > 30);
  
  let summary;
  if (!paragraphs.length) {
    summary = '页面内容较少，无法提取摘要';
  } else if (paragraphs.length <= 4) {
    summary = '📄 ' + title + '\\n\\n' + paragraphs.join('\\n\\n');
  } else {
    // Split into sentences and score
    const sentences = [];
    paragraphs.forEach((p, i) => {
      const parts = p.split(/(?<=[。！？.!?])\\s*/).filter(s => s.length > 10);
      parts.forEach((s, j) => sentences.push({ text: s, paraIdx: i, posInPara: j }));
    });
    
    if (sentences.length <= 5) {
      summary = '📄 ' + title + '\\n\\n' + sentences.map(s => s.text).join(' ');
    } else {
      // Word frequency
      const wordFreq = {};
      sentences.forEach(s => {
        s.text.split(/[，。！？,\\.!?\\s]+/).forEach(w => {
          if (w.length >= 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
      });
      const totalSentences = sentences.length;
      
      sentences.forEach((s, i) => {
        let score = 2.0 / Math.sqrt(i / 2 + 1); // position
        const len = s.text.length;
        if (len > 40 && len < 150) score += 1.5;
        else if (len < 20 || len > 250) score -= 1;
        
        const words = s.text.split(/[，。！？,\\.!?\\s]+/).filter(w => w.length >= 3);
        let kwScore = 0;
        words.forEach(w => {
          if (wordFreq[w] && wordFreq[w] > 1) kwScore += Math.min(wordFreq[w] / totalSentences * 5, 1);
        });
        score += kwScore / Math.max(words.length, 1) * 3;
        
        if (title) {
          const tw = new Set(title.split(/[\\s]+/).filter(w => w.length >= 2));
          words.forEach(w => { if (tw.has(w)) score += 0.5; });
        }
        s.score = score;
      });
      
      const topN = Math.min(8, Math.max(4, Math.floor(sentences.length * 0.3)));
      sentences.sort((a, b) => b.score - a.score);
      const picked = sentences.slice(0, topN);
      picked.sort((a, b) => a.paraIdx - b.paraIdx || a.posInPara - b.posInPara);
      
      summary = '📄 ' + title + '\\n\\n' + picked.map(s => s.text).join(' ');
    }
  }
  
  // Copyable summary text
  const escaped = summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  
  const popup = document.createElement('div');
  popup.id = 'knexio-summary-popup';
  
  // Position: center of viewport, upper third
  const top = Math.max(20, window.innerHeight * 0.15);
  const left = Math.max(8, window.innerWidth / 2 - 220);
  
  popup.innerHTML = `
    <div style="
      position: fixed; z-index: 2147483647;
      top: ${top}px;
      left: ${left}px;
      width: 440px;
      background: #1a1a2e; color: #e0e0e0;
      padding: 14px 16px; border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.7;
      border: 1px solid #2a2a3e;
    ">
      <div style="margin-bottom:8px">
        <span style="font-size:11px;color:#888">智能摘句 · 本页摘要</span>
      </div>
      <button id="knexio-close-summary" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#888;cursor:pointer;font-size:14px;line-height:1">✕</button>
      <div style="display:flex;gap:8px;margin-bottom:6px">
          <button id="knexio-copy-summary" style="background:#2a2a3e;border:none;color:#aaa;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:4px">复制</button>
        </div>
      </div>
      <div>${escaped}</div>
    </div>
  `;
  document.body.appendChild(popup);
  
  const rawText = summary;
  document.getElementById('knexio-copy-summary').onclick = () => {
    navigator.clipboard.writeText(rawText);
    const btn = document.getElementById('knexio-copy-summary');
    if (btn) { btn.textContent = '已复制 ✓'; setTimeout(() => { if (btn) btn.textContent = '复制'; }, 1500); }
  };
  document.getElementById('knexio-close-summary').onclick = () => popup.remove();
  setTimeout(() => { if (document.getElementById('knexio-summary-popup')) popup.remove(); }, 20000);
}
