// Knexio 阅读伴侣 — content.js
// Injected into every page: adds floating translate button on text selection

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
  floatingBtn.innerHTML = '🔤 翻译';
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
      
      showInlineTranslation(translated, rect);
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

function showInlineTranslation(text, rect) {
  const existing = document.getElementById('knexio-inline-trans');
  if (existing) existing.remove();
  
  const div = document.createElement('div');
  div.id = 'knexio-inline-trans';
  div.innerHTML = `
    <div style="
      position: fixed; z-index: 2147483647;
      top: ${rect.bottom + window.scrollY + 6}px;
      left: ${rect.left + window.scrollX}px;
      max-width: 420px; max-height: 240px; overflow-y: auto;
      background: #1a1a2e; color: #e0e0e0;
      padding: 10px 14px; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6;
      border: 1px solid #2a2a3e;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;color:#888">翻译为中文</span>
        <button id="knexio-close-inline" style="background:none;border:none;color:#888;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div>${text.replace(/\n/g, '<br>')}</div>
    </div>
  `;
  document.body.appendChild(div);
  document.getElementById('knexio-close-inline').onclick = () => div.remove();
  setTimeout(() => { if (document.getElementById('knexio-inline-trans')) div.remove(); }, 10000);
}
