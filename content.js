// Knexio 阅读伴侣 — content.js
// Injected into every page: adds floating translate button on text selection

// Simple inline i18n
var _lang = (navigator.language || 'en').startsWith('zh') ? 'zh' : 'en';
var _t = function(key) {
  var map = {
    zh: { float_translate: '🔤 翻译', float_translating: '翻译中…', failed: '翻译失败', copy: '复制', copied: '已复制', copy_orig: '复制原文', copy_trans: '复制译文', original: '原文', translation: '译文' },
    en: { float_translate: '🔤 Translate', float_translating: 'Translating…', failed: 'Translation failed', copy: 'Copy', copied: 'Copied', copy_orig: 'Copy Original', copy_trans: 'Copy Translation', original: 'Original', translation: 'Translation' }
  };
  return (map[_lang] || map.en)[key] || key;
};

let floatingBtn = null;

document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection?.toString()?.trim();
  
  // Remove old button
  if (floatingBtn) { floatingBtn.remove(); floatingBtn = null; }
  
  if (!text || text.length < 3 || text.length > 3000) return;
  
  // Don't show inside our own popup
  if (e.target.closest('#knexio-translate-popup')) return;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  floatingBtn = document.createElement('div');
  floatingBtn.id = 'knexio-float-btn';
  floatingBtn.innerHTML = _t('float_translate');
  Object.assign(floatingBtn.style, {
    position: 'fixed',
    zIndex: '2147483646',
    top: `${rect.top + window.scrollY - 32}px`,
    left: `${rect.left + window.scrollX}px`,
    padding: '4px 10px',
    background: '#4f8ff7',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: '-apple-system, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    userSelect: 'none',
    transition: 'opacity 0.15s'
  });
  
  floatingBtn.addEventListener('click', async () => {
    floatingBtn.innerHTML = '⏳';
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      const translated = data[0].map(x => x[0]).join('');
      
      floatingBtn.remove();
      floatingBtn = null;
      
      // Position relative to selection, avoiding overlap
      const mouseY = e.clientY;
      showInlineTranslation(text, translated, rect, mouseY);
    } catch (e) {
      floatingBtn.innerHTML = '❌';
      setTimeout(() => { if (floatingBtn) floatingBtn.remove(); floatingBtn = null; }, 1000);
    }
  });
  
  document.body.appendChild(floatingBtn);
});

// Remove button when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  if (floatingBtn && !e.target.closest('#knexio-float-btn')) {
    floatingBtn.remove();
    floatingBtn = null;
  }
});

function showInlineTranslation(origText, translated, selRect, mouseY) {
  const existing = document.getElementById('knexio-inline-trans');
  if (existing) existing.remove();

  const popupW = 420;
  const popupH = 240; // max-height
  const gap = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // Horizontal: center on selection, clamp to viewport
  let left = selRect.left + selRect.width / 2 - popupW / 2;
  left = Math.max(8, Math.min(vw - popupW - 8, left));
  
  // Vertical: prefer opposite side of mouse within selection
  // If mouse is in upper half of selection → show below; lower half → show above
  const selMid = selRect.top + selRect.height / 2;
  const spaceBelow = vh - selRect.bottom - gap;
  const spaceAbove = selRect.top - gap;
  
  let top, maxH;
  if (mouseY < selMid && spaceBelow > 120) {
    // Show below
    top = selRect.bottom + gap;
    maxH = Math.min(popupH, vh - top - 12);
  } else if (spaceAbove > 120) {
    // Show above — popup bottom aligns to selRect.top - gap
    maxH = Math.min(popupH, selRect.top - gap - 12);
    top = selRect.top - gap - maxH;
  } else if (spaceBelow > 100) {
    top = selRect.bottom + gap;
    maxH = Math.min(popupH, vh - top - 12);
  } else {
    // Above as fallback
    maxH = Math.min(popupH, Math.max(80, selRect.top - 12));
    top = Math.max(8, selRect.top - gap - maxH);
  }

  var escapedOrig = origText.split('\n').join('<br>');
  var escapedTrans = translated.split('\n').join('<br>');
  
  const div = document.createElement('div');
  div.id = 'knexio-inline-trans';
  div.innerHTML = `
    <div style="
      position: fixed; z-index: 2147483647;
      top: ${top}px;
      left: ${left}px;
      width: ${popupW}px;
      max-height: ${Math.max(60, maxH)}px;
      background: #1a1a2e; color: #e0e0e0;
      padding: 10px 14px; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6;
      border: 1px solid #2a2a3e;
      display: flex; flex-direction: column;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid #2a2a3e;flex-shrink:0">
        <div style="display:flex;gap:6px">
          <button id="knexio-copy-orig-inline" style="background:#2a2a3e;border:none;color:#aaa;cursor:pointer;font-size:10px;padding:2px 8px;border-radius:4px">${_t('copy_orig')}</button>
          <button id="knexio-copy-trans-inline" style="background:#2a2a3e;border:none;color:#aaa;cursor:pointer;font-size:10px;padding:2px 8px;border-radius:4px">${_t('copy_trans')}</button>
        </div>
        <button id="knexio-close-inline" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;line-height:1;padding:0 2px">✕</button>
      </div>
      <div id="knexio-inline-body" style="overflow-y:auto;padding-top:6px;flex:1">
        <div id="knexio-orig-inline" style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #2a2a3e;color:#aaa;font-size:12px">${escapedOrig}</div>
        <div id="knexio-trans-inline-text" style="font-size:13px">${escapedTrans}</div>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  document.getElementById('knexio-close-inline').onclick = () => div.remove();
  
  var copyOrigBtn = document.getElementById('knexio-copy-orig-inline');
  var copyTransBtn = document.getElementById('knexio-copy-trans-inline');
  copyOrigBtn.onclick = function() {
    navigator.clipboard.writeText(origText).then(function() {
      copyOrigBtn.textContent = _t('copied');
      setTimeout(function() { copyOrigBtn.textContent = _t('copy_orig'); }, 1500);
    });
  };
  copyTransBtn.onclick = function() {
    navigator.clipboard.writeText(translated).then(function() {
      copyTransBtn.textContent = _t('copied');
      setTimeout(function() { copyTransBtn.textContent = _t('copy_trans'); }, 1500);
    });
  };
  
  setTimeout(() => { if (document.getElementById('knexio-inline-trans')) div.remove(); }, 10000);
}
