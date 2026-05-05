// Content script - injected into every page
// Handles: floating result panel, text selection detection

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'show_result') {
    showResultPanel(request);
  }
});

function showResultPanel(request) {
  // Remove existing panel
  const existing = document.getElementById('knexio-result-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'knexio-result-panel';
  panel.className = 'knexio-panel';

  let title, content;
  if (request.type === 'translate') {
    title = '🌐 翻译结果';
    content = `<div class="knexio-original">${escapeHtml(request.text.substring(0, 200))}${request.text.length > 200 ? '...' : ''}</div>
               <div class="knexio-result">${escapeHtml(request.result)}</div>`;
  } else if (request.type === 'summarize') {
    title = '📝 AI 摘要';
    content = `<div class="knexio-result">${escapeHtml(request.result)}</div>`;
  } else if (request.type === 'error') {
    title = '⚠️ 错误';
    content = `<div style="color:#ef4444">${escapeHtml(request.error)}</div>`;
  }

  panel.innerHTML = `
    <div class="knexio-header">
      <span>${title}</span>
      <button class="knexio-close" onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
    <div class="knexio-body">${content}</div>
    <div style="padding:4px 12px 8px;display:flex;gap:8px">
      <button onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.querySelector('.knexio-result').textContent)" 
              style="font-size:12px;padding:3px 8px;background:#2a2a4a;border:none;border-radius:4px;color:#a0a0c0;cursor:pointer">📋 复制</button>
    </div>
  `;

  document.body.appendChild(panel);

  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (panel.parentElement) panel.remove();
  }, 30000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
