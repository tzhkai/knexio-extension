// Knexio 阅读伴侣 — background.js (service worker)

// Simple inline i18n
var _lang = ('undefined' !== typeof navigator && (navigator.language || 'en').startsWith('zh')) ? 'zh' : 'en';
var _t = function(key) {
  var map = {
    zh: {
      ctx_translate: '🔤 翻译选中文字',
      ctx_summarize: '✂️ 智能摘句（本页）',
      popup_translating: '翻译中…',
      popup_translate_title: '翻译选中文字',
      popup_summary_title: '智能摘句 · 本页摘要',
      popup_original: '原文',
      popup_translated: '译文',
      copied: '已复制 ✓',
      copy: '复制',
      close: '✕',
      summary_translate_btn: '🌐 翻译',
      translating: '翻译中…',
      translated: '已翻译',
      summary_original_btn: '查看原文'
    },
    en: {
      ctx_translate: '🔤 Translate Selection',
      ctx_summarize: '✂️ Smart Extract (Page)',
      popup_translating: 'Translating…',
      popup_translate_title: 'Translate Selection',
      popup_summary_title: 'Smart Extract · Page Summary',
      popup_original: 'Original',
      popup_translated: 'Translation',
      copied: 'Copied ✓',
      copy: 'Copy',
      close: '✕',
      summary_translate_btn: '🌐 Translate',
      translating: 'Translating…',
      translated: 'Translated',
      summary_original_btn: 'Show Original'
    }
  };
  return (map[_lang] || map.en)[key] || key;
};

// ── Context menu: translate selection ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: _t('ctx_translate'),
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'summarize-page',
    title: _t('ctx_summarize'),
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
      args: [text, translated, targetLang === 'en' ? 'English' : '中文']
    });
  } catch (e) {
    console.error('Translation error:', e);
  }
}

// This function runs in the page context
function showTranslationPopup(origText, translated, langLabel) {
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
  
  const escapedOrig = origText.split('\n').join('<br>');
  const escapedTrans = translated.split('\n').join('<br>');
  const popup = document.createElement('div');
  popup.id = 'knexio-translate-popup';
  popup.innerHTML = `
    <div style="
      position: fixed; z-index: 2147483647;
      top: ${top}px;
      left: ${left}px;
      width: ${popupW}px;
      max-height: 400px; overflow-y: auto;
      background: #1a1a2e; color: #e0e0e0;
      padding: 14px 16px; border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6;
      border: 1px solid #2a2a3e;
    ">
      <button id="knexio-close-popup" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#888;cursor:pointer;font-size:14px;line-height:1">✕</button>
      <div style="margin-bottom:6px">
        <span style="font-size:11px;color:#888">${_t('popup_original')}</span>
        <button id="knexio-copy-orig" style="background:#2a2a3e;border:none;color:#aaa;cursor:pointer;font-size:10px;padding:2px 6px;border-radius:3px;float:right">${_t('copy')}</button>
      </div>
      <div id="knexio-orig-text" style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #2a2a3e;color:#aaa">${escapedOrig}</div>
      <div style="margin-bottom:6px">
        <span style="font-size:11px;color:#888">${_t('popup_translated')} · ${langLabel}</span>
        <button id="knexio-copy-trans" style="background:#2a2a3e;border:none;color:#aaa;cursor:pointer;font-size:10px;padding:2px 6px;border-radius:3px;float:right">${_t('copy')}</button>
      </div>
      <div id="knexio-trans-text">${escapedTrans}</div>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('knexio-close-popup').onclick = () => popup.remove();
  
  // Copy buttons
  var copyOrigBtn = document.getElementById('knexio-copy-orig');
  var copyTransBtn = document.getElementById('knexio-copy-trans');
  var origTextContent = origText;
  var transTextContent = translated;
  
  copyOrigBtn.onclick = function() {
    navigator.clipboard.writeText(origTextContent).then(function() {
      copyOrigBtn.textContent = _t('copied');
      setTimeout(function() { copyOrigBtn.textContent = _t('copy'); }, 1500);
    });
  };
  copyTransBtn.onclick = function() {
    navigator.clipboard.writeText(transTextContent).then(function() {
      copyTransBtn.textContent = _t('copied');
      setTimeout(function() { copyTransBtn.textContent = _t('copy'); }, 1500);
    });
  };
  
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
  // Inline i18n for page context
  var _l = (navigator.language || 'en').startsWith('zh') ? 'zh' : 'en';
  var _tt = function(k) {
    var m = {
      zh: { no_content: '页面内容较少，无法提取摘要', title: '智能摘句 · 本页摘要', copy: '复制', copied: '已复制 ✓', translate: '🌐 翻译', translating: '翻译中…', translated: '已翻译', original: '查看原文', fail: '❌' },
      en: { no_content: 'Page has too little content to summarize', title: 'Smart Extract · Page Summary', copy: 'Copy', copied: 'Copied ✓', translate: '🌐 Translate', translating: 'Translating…', translated: 'Translated', original: 'Show Original', fail: '❌' }
    };
    return (m[_l] || m.en)[k] || k;
  };
  const existing = document.getElementById('knexio-summary-popup');
  if (existing) existing.remove();
  
  const title = document.title || '';
  const article = document.querySelector('article') || document.querySelector('main') || document.body;
  const paragraphs = Array.from(article.querySelectorAll('p')).map(function(p) { return p.innerText.trim(); }).filter(function(t) { return t.length > 30; });
  
  var summary;
  if (!paragraphs.length) {
    summary = _tt('no_content');
  } else if (paragraphs.length <= 4) {
    summary = paragraphs.join('\n\n');
  } else {
    var sentences = [];
    paragraphs.forEach(function(p, i) {
      var parts = p.split(/(?<=[。！？.!?])\s*/).filter(function(s) { return s.length > 10; });
      parts.forEach(function(s, j) { sentences.push({ text: s, paraIdx: i, posInPara: j }); });
    });
    
    if (sentences.length <= 5) {
      summary = sentences.map(function(s) { return s.text; }).join(' ');
    } else {
      var wordFreq = {};
      sentences.forEach(function(s) {
        s.text.split(/[，。！？,.!?\s]+/).forEach(function(w) {
          if (w.length >= 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
      });
      var totalSentences = sentences.length;
      
      sentences.forEach(function(s, i) {
        var score = 2.0 / Math.sqrt(i / 2 + 1);
        var len = s.text.length;
        if (len > 40 && len < 150) score += 1.5;
        else if (len < 20 || len > 250) score -= 1;
        
        var words = s.text.split(/[，。！？,.!?\s]+/).filter(function(w) { return w.length >= 3; });
        var kwScore = 0;
        words.forEach(function(w) {
          if (wordFreq[w] && wordFreq[w] > 1) kwScore += Math.min(wordFreq[w] / totalSentences * 5, 1);
        });
        score += kwScore / Math.max(words.length, 1) * 3;
        
        if (title) {
          var tw = title.split(/[\s]+/).filter(function(w) { return w.length >= 2; });
          words.forEach(function(w) { if (tw.indexOf(w) >= 0) score += 0.5; });
        }
        s.score = score;
      });
      
      var topN = Math.min(8, Math.max(4, Math.floor(sentences.length * 0.3)));
      sentences.sort(function(a, b) { return b.score - a.score; });
      var picked = sentences.slice(0, topN);
      picked.sort(function(a, b) { return a.paraIdx - b.paraIdx || a.posInPara - b.posInPara; });
      
      summary = picked.map(function(s) { return s.text; }).join(' ');
    }
  }
  
  var escaped = summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  
  var top = Math.max(20, window.innerHeight * 0.15);
  var left = Math.max(8, window.innerWidth / 2 - 220);
  
  var popup = document.createElement('div');
  popup.id = 'knexio-summary-popup';
  popup.innerHTML = '<div style="position:fixed;z-index:2147483647;top:' + top + 'px;left:' + left + 'px;width:440px;max-height:400px;overflow-y:auto;background:#1a1a2e;color:#e0e0e0;padding:14px 16px;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.5);font-family:-apple-system,sans-serif;font-size:13px;line-height:1.7;border:1px solid #2a2a3e">' +
    '<div style="margin-bottom:8px"><span style="font-size:11px;color:#888">' + _tt('title') + '</span></div>' +
    '<button id="knexio-close-summary" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#888;cursor:pointer;font-size:14px;line-height:1">✕</button>' +
    '<div style="display:flex;gap:8px;margin-bottom:6px">' +
      '<button id="knexio-copy-summary" style="background:#2a2a3e;border:none;color:#aaa;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:4px">' + _tt('copy') + '</button>' +
      '<button id="knexio-trans-summary" style="background:#2a2a3e;border:none;color:#e67e22;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:4px">' + _tt('translate') + '</button>' +
    '</div>' +
    '<div id="knexio-summary-text">' + escaped + '</div>' +
  '</div>';
  document.body.appendChild(popup);
  
  document.getElementById('knexio-close-summary').onclick = function() { popup.remove(); };
  document.getElementById('knexio-copy-summary').onclick = function() {
    navigator.clipboard.writeText(summary);
    var btn = document.getElementById('knexio-copy-summary');
    if (btn) { btn.textContent = _tt('copied'); setTimeout(function() { if (btn) btn.textContent = _tt('copy'); }, 1500); }
  };
  document.getElementById('knexio-trans-summary').onclick = async function() {
    var btn = document.getElementById('knexio-trans-summary');
    if (!btn || btn.textContent === _tt('translating')) return;
    btn.textContent = _tt('translating');
    btn.style.color = '#888';
    try {
      var res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(summary));
      var data = await res.json();
      var translated = data[0].map(function(x) { return x[0]; }).join('');
      var el = document.getElementById('knexio-summary-text');
      if (el) el.innerHTML = '<div style="color:#e67e22;margin-bottom:4px;font-size:11px">翻译为中文 ↓</div>' + el.innerHTML + '<div style="border-top:1px solid #2a2a3e;margin-top:8px;padding-top:8px">' + translated.replace(/\n/g, '<br>') + '</div>';
      btn.textContent = _tt('translated');
      setTimeout(function() { if (btn) btn.textContent = _tt('translate'); btn.style.color = '#e67e22'; }, 2000);
    } catch(e) {
      btn.textContent = _tt('fail');
      setTimeout(function() { if (btn) btn.textContent = _tt('translate'); btn.style.color = '#e67e22'; }, 1500);
    }
  };
  setTimeout(function() { if (document.getElementById('knexio-summary-popup')) popup.remove(); }, 20000);
}
