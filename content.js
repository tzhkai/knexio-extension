// Knexio 阅读伴侣 — content.js
// Injected into every page: adds floating translate button on text selection

// Simple inline i18n
var _lang = (navigator.language || 'en').startsWith('zh') ? 'zh' : 'en';
var _t = function(key) {
  var map = {
    zh: { float_translate: '🔤 翻译', float_translating: '翻译中…', failed: '翻译失败' },
    en: { float_translate: '🔤 Translate', float_translating: 'Translating…', failed: 'Translation failed' }
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
      showInlineTranslation(translated, rect, mouseY);
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

function showInlineTranslation(text, selRect, mouseY) {
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
  
  let top, fromBottom;
  if (mouseY < selMid && spaceBelow > 120) {
    // Show below
    top = selRect.bottom + gap;
    fromBottom = false;
  } else if (spaceAbove > 120) {
    // Show above
    top = selRect.top - gap;
    fromBottom = true;
  } else if (spaceBelow > 100) {
    top = selRect.bottom + gap;
    fromBottom = false;
  } else {
    top = selRect.top - gap;
    fromBottom = true;
  }
  
  // Actual max height: clamp to available space
  const maxH = Math.min(popupH, fromBottom ? selRect.top - 16 : vh - selRect.bottom - 16);

  const div = document.createElement('div');
  div.id = 'knexio-inline-trans';
  div.innerHTML = `
    <div style="
      position: fixed; z-index: 2147483647;
      top: ${top}px;
      left: ${left}px;
      width: ${popupW}px;
      max-height: ${Math.max(60, maxH)}px;
      overflow-y: auto;
      background: #1a1a2e; color: #e0e0e0;
      padding: 10px 14px; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6;
      border: 1px solid #2a2a3e;
    ">
      <div style="margin-bottom:6px">
        <span style="font-size:11px;color:#888">翻译为中文</span>
      </div>
      <button id="knexio-close-inline" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#888;cursor:pointer;font-size:14px;line-height:1">✕</button>
      <div style="padding-right:8px">${text.replace(/\n/g, '<br>')}</div>
    </div>
  `;
  document.body.appendChild(div);
  document.getElementById('knexio-close-inline').onclick = () => div.remove();
  setTimeout(() => { if (document.getElementById('knexio-inline-trans')) div.remove(); }, 10000);
}
