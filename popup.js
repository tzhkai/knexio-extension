// Knexio 阅读伴侣 — popup.js

// ── Apply i18n to all [data-i18n] elements ──
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = I18N.t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = I18N.t(el.dataset.i18nPlaceholder);
  });
}
applyI18n();

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ── Translate ──
document.getElementById('translate-btn').addEventListener('click', async () => {
  const input = document.getElementById('translate-input').value.trim();
  const target = document.getElementById('translate-to').value;
  const resultBox = document.getElementById('translate-result');
  const actions = document.getElementById('translate-actions');
  
  if (!input) { resultBox.textContent = I18N.t('translate_input_hint'); return; }
  if (input.length > 5000) { resultBox.textContent = '文字太长，最多 5000 字'; return; }
  
  resultBox.textContent = I18N.t('translating');
  actions.style.display = 'none';
  
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(input)}`);
    const data = await res.json();
    const translated = data[0].map(x => x[0]).join('');
    resultBox.textContent = translated;
    actions.style.display = 'block';
  } catch (e) {
    resultBox.textContent = I18N.t('translate_failed') + ': ' + e.message;
  }
});

// ── Summarize ──
let hasApiKey = false;
let currentPageText = '';

chrome.storage.sync.get(['deepseek_api_key'], async (items) => {
  const status = document.getElementById('summarize-status');
  if (items.deepseek_api_key) {
    hasApiKey = true;
    status.innerHTML = '<span class="status-icon">🟢</span> ' + I18N.t('summarize_ready_ai');
    document.getElementById('ai-summarize-btn').style.display = 'block';
  } else {
    status.innerHTML = '<span class="status-icon">🟡</span> ' + I18N.t('summarize_ready_no_ai');
  }
});

// Extract page content (shared)
async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const title = document.title || '';
      const article = document.querySelector('article') || document.querySelector('main') || document.body;
      const allPs = Array.from(article.querySelectorAll('p')).map(p => p.innerText.trim()).filter(t => t.length > 30);
      const fullText = article.innerText.replace(/\s+/g, ' ').trim();
      return { title, paragraphs: allPs, fullText: fullText.substring(0, 8000) };
    }
  });
  return result;
}

// Extractive summarization — picks key sentences, pure frontend no AI
function buildExtractiveSummary(data) {
  const paras = data.paragraphs;
  if (!paras.length) return I18N.t('summarize_no_content');
  if (paras.length <= 4) return '📄 ' + data.title + '\n\n' + paras.join('\n\n');
  
  const sentences = [];
  paras.forEach((p, i) => {
    const parts = p.split(/(?<=[。！？.!?])\s*/).filter(s => s.length > 10);
    parts.forEach((s, j) => {
      sentences.push({ text: s, paraIdx: i, posInPara: j });
    });
  });
  
  if (sentences.length <= 5) return '📄 ' + data.title + '\n\n' + sentences.map(s => s.text).join(' ');
  
  const wordFreq = {};
  sentences.forEach(s => {
    s.text.split(/[，。！？,\.!?\s]+/).forEach(w => {
      if (w.length >= 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
  });
  const totalSentences = sentences.length;
  
  sentences.forEach((s, i) => {
    let score = 0;
    score += 2.0 / Math.sqrt(i / 2 + 1);
    const len = s.text.length;
    if (len > 40 && len < 150) score += 1.5;
    else if (len < 20 || len > 250) score -= 1;
    
    const words = s.text.split(/[，。！？,\.!?\s]+/).filter(w => w.length >= 3);
    let kwScore = 0;
    words.forEach(w => {
      if (wordFreq[w] && wordFreq[w] > 1) kwScore += Math.min(wordFreq[w] / totalSentences * 5, 1);
    });
    score += kwScore / Math.max(words.length, 1) * 3;
    
    if (data.title) {
      const titleWords = new Set(data.title.split(/[\s]+/).filter(w => w.length >= 2));
      words.forEach(w => { if (titleWords.has(w)) score += 0.5; });
    }
    s.score = score;
  });
  
  const topN = Math.min(8, Math.max(4, Math.floor(sentences.length * 0.3)));
  sentences.sort((a, b) => b.score - a.score);
  const picked = sentences.slice(0, topN);
  picked.sort((a, b) => a.paraIdx - b.paraIdx || a.posInPara - b.posInPara);
  
  return '📄 ' + data.title + '\n\n' + picked.map(s => s.text).join(' ');
}

// Smart extract button
document.getElementById('summarize-btn').addEventListener('click', async () => {
  const btn = document.getElementById('summarize-btn');
  const resultBox = document.getElementById('summarize-result');
  
  btn.disabled = true;
  btn.textContent = I18N.t('summarize_analyzing');
  resultBox.textContent = '';
  document.getElementById('summarize-actions').style.display = 'none';
  
  try {
    const data = await extractPageContent();
    if (!data || !data.paragraphs.length) {
      resultBox.textContent = I18N.t('summarize_no_content');
      btn.textContent = I18N.t('summarize_btn');
      btn.disabled = false;
      return;
    }
    currentPageText = data.fullText;
    resultBox.textContent = buildExtractiveSummary(data);
    btn.textContent = I18N.t('summarize_btn');
    btn.disabled = false;
    document.getElementById('summarize-actions').style.display = 'block';
  } catch (e) {
    resultBox.textContent = I18N.t('summarize_extract_fail') + ': ' + e.message;
    btn.textContent = I18N.t('summarize_btn');
    btn.disabled = false;
  }
});

// AI summary button
document.getElementById('ai-summarize-btn').addEventListener('click', async () => {
  const btn = document.getElementById('ai-summarize-btn');
  const resultBox = document.getElementById('summarize-result');
  
  btn.disabled = true;
  btn.textContent = I18N.t('summarize_ai_thinking');
  
  try {
    if (!currentPageText) {
      const data = await extractPageContent();
      currentPageText = data?.fullText || '';
    }
    
    if (currentPageText.length < 100) {
      resultBox.textContent = I18N.t('summarize_ai_no_content');
      btn.textContent = I18N.t('ai_summarize_btn');
      btn.disabled = false;
      return;
    }
    
    const { deepseek_api_key } = await chrome.storage.sync.get(['deepseek_api_key']);
    if (!deepseek_api_key) {
      resultBox.textContent = I18N.t('summarize_ai_no_key');
      btn.textContent = I18N.t('ai_summarize_btn');
      btn.disabled = false;
      return;
    }
    
    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseek_api_key}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: `请用中文生成以下网页内容的摘要（200-300字），突出核心要点：\n\n${currentPageText}`
        }],
        max_tokens: 600,
        temperature: 0.3
      })
    });
    
    const data = await apiRes.json();
    if (data.error) throw new Error(data.error.message || 'API error');
    resultBox.textContent = data.choices[0].message.content;
    btn.textContent = I18N.t('ai_summarize_btn');
    btn.disabled = false;
    document.getElementById('summarize-actions').style.display = 'block';
    
  } catch (e) {
    resultBox.textContent = I18N.t('summarize_ai_fail') + ': ' + e.message;
    btn.textContent = I18N.t('ai_summarize_btn');
    btn.disabled = false;
  }
});

// ── 摘要翻译按钮 ──
let summarizeOriginalText = '';
let summarizeTranslated = false;

document.getElementById('summarize-translate-btn').addEventListener('click', async () => {
  const btn = document.getElementById('summarize-translate-btn');
  const origBtn = document.getElementById('summarize-original-btn');
  const resultBox = document.getElementById('summarize-result');
  
  if (summarizeTranslated) return;
  
  const text = resultBox.textContent;
  if (!text || text.startsWith('⏳') || text.startsWith(I18N.t('summarize_extract_fail')) || text === I18N.t('summarize_no_content') || text.startsWith(I18N.t('summarize_ai_fail'))) return;
  
  btn.textContent = I18N.t('translating');
  btn.disabled = true;
  
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    const translated = data[0].map(x => x[0]).join('');
    
    summarizeOriginalText = text;
    summarizeTranslated = true;
    resultBox.textContent = translated;
    btn.textContent = I18N.t('translated');
    btn.style.color = '#27ae60';
    origBtn.style.display = 'inline-block';
  } catch (e) {
    btn.textContent = I18N.t('translate_failed');
    setTimeout(() => { btn.textContent = I18N.t('summarize_translate_btn'); btn.disabled = false; }, 1500);
  }
});

document.getElementById('summarize-original-btn').addEventListener('click', () => {
  const resultBox = document.getElementById('summarize-result');
  const btn = document.getElementById('summarize-translate-btn');
  const origBtn = document.getElementById('summarize-original-btn');
  
  if (summarizeTranslated) {
    resultBox.textContent = summarizeOriginalText;
    summarizeTranslated = false;
    btn.textContent = I18N.t('summarize_translate_btn');
    btn.style.color = '#e67e22';
    btn.disabled = false;
    origBtn.style.display = 'none';
  }
});

// ── Markdown 剪藏 ──
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('md-title').textContent = tab.title;
  document.getElementById('md-url').textContent = tab.url;
})();

document.getElementById('md-btn').addEventListener('click', async () => {
  const resultBox = document.getElementById('md-result');
  resultBox.textContent = I18N.t('md_extracting');
  resultBox.className = 'result-box';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageAsMarkdown
    });
    
    if (!results || !results[0] || !results[0].result) {
      resultBox.textContent = I18N.t('md_fail');
      resultBox.className = 'result-box error';
      return;
    }
    
    const md = '# ' + tab.title + '\n\n> ' + tab.url + '\n\n' + results[0].result;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(md);
    resultBox.textContent = I18N.t('md_ok');
    resultBox.className = 'result-box success';
    
    // Open MarkdownMaster editor
    setTimeout(() => {
      window.open('https://markdownmaster.site/editor/', '_blank');
    }, 400);
  } catch (e) {
    resultBox.textContent = I18N.t('md_fail');
    resultBox.className = 'result-box error';
  }
});

// Page-context extraction (lightweight, no dependency)
function extractPageAsMarkdown() {
  var main = document.querySelector('article') ||
             document.querySelector('[role="main"]') ||
             document.querySelector('main') ||
             document.querySelector('.post-content') ||
             document.querySelector('.article-content') ||
             document.querySelector('.entry-content') ||
             document.querySelector('#content') ||
             document.querySelector('.content');

  if (!main) {
    var body = document.body.cloneNode(true);
    var remove = body.querySelectorAll('script, style, nav, header:not(article header), footer, aside, .sidebar, .nav, .menu, .ad, .advertisement, [class*="comment"], .related, .recommend, .share, .social');
    remove.forEach(function(el) { el.remove(); });
    main = body;
  }

  var clone = main.cloneNode(true);
  var junk = clone.querySelectorAll('script, style, noscript, iframe, form, input, button, select, textarea, [style*="display:none"], [hidden], [aria-hidden="true"], .hidden, .sr-only, nav, .nav, .sidebar, .footer-nav');
  junk.forEach(function(el) { el.remove(); });

  function htmlToMd(el) {
    var out = '';
    function walk(n) {
      if (n.nodeType === 3) { var t = n.textContent; if (t.trim()) out += t; return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toLowerCase();
      var children = n.childNodes;
      var txt = (n.textContent || '').trim();
      var hasImg = n.querySelector('img');
      if (!txt && !hasImg) return;
      switch (tag) {
        case 'h1': out += '\n\n# '; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'h2': out += '\n\n## '; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'h3': out += '\n\n### '; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'h4': out += '\n\n#### '; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'h5': out += '\n\n##### '; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'p': out += '\n\n'; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'br': out += '\n'; break;
        case 'hr': out += '\n\n---\n\n'; break;
        case 'strong': case 'b': out += '**'; Array.from(children).forEach(walk); out += '**'; break;
        case 'em': case 'i': out += '*'; Array.from(children).forEach(walk); out += '*'; break;
        case 'code':
          if (n.parentNode && n.parentNode.tagName === 'PRE') { out += n.textContent; return; }
          out += '`' + n.textContent + '`'; return;
        case 'pre':
          var ce = n.querySelector('code');
          var lang = '';
          if (ce) { var m = (ce.className||'').match(/language-(\w+)/); if (m) lang = m[1]; }
          out += '\n\n```' + lang + '\n' + (ce ? ce.textContent : n.textContent) + '\n```\n\n';
          return;
        case 'a':
          var href = n.getAttribute('href') || '';
          if (!href || href.startsWith('javascript:') || href === '#') {
            Array.from(children).forEach(walk); return;
          }
          if (href.startsWith('/')) href = window.location.origin + href;
          else if (!href.startsWith('http')) href = window.location.origin + '/' + href;
          out += '[' + (n.textContent||'').trim() + '](' + href + ')';
          return;
        case 'img':
          var alt = n.getAttribute('alt') || '';
          var src = n.getAttribute('src') || n.getAttribute('data-src') || '';
          if (src && !src.startsWith('data:')) {
            if (src.startsWith('/')) src = window.location.origin + src;
            else if (!src.startsWith('http')) src = window.location.origin + '/' + src;
            out += '\n\n![' + alt + '](' + src + ')\n\n';
          }
          return;
        case 'blockquote': out += '\n\n> '; Array.from(children).forEach(walk); out += '\n\n'; break;
        case 'ul': out += '\n'; Array.from(children).forEach(function(li) { if (li.tagName === 'LI') { out += '- '; Array.from(li.childNodes).forEach(walk); out += '\n'; } }); out += '\n'; return;
        case 'ol': out += '\n'; var idx2 = 1; Array.from(children).forEach(function(li) { if (li.tagName === 'LI') { out += (idx2++) + '. '; Array.from(li.childNodes).forEach(walk); out += '\n'; } }); out += '\n'; return;
        case 'li': return;
        case 'table':
          var rows = n.querySelectorAll('tr');
          out += '\n\n';
          rows.forEach(function(r, ri) {
            var cells = r.querySelectorAll('td, th');
            out += '| ' + Array.from(cells).map(function(c) { return (c.textContent||'').trim().replace(/\|/g,'\\|'); }).join(' | ') + ' |\n';
            if (ri === 0) out += '| ' + Array.from(cells).map(function() { return '---'; }).join(' | ') + ' |\n';
          });
          return;
        case 'div': case 'section': case 'span': case 'article': case 'header': case 'footer': case 'main':
          Array.from(children).forEach(walk); break;
        default: Array.from(children).forEach(walk);
      }
    }
    walk(el);
    return out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '\n').trim();
  }

  return htmlToMd(clone);
}

// ── Copy buttons ──
document.querySelectorAll('.copy-btn[data-target]').forEach(btn => {
  const origText = btn.textContent;
  btn.addEventListener('click', (e) => {
    if (btn.id && btn.id !== '') return;
    const target = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(target.textContent);
    btn.textContent = I18N.t('copied');
    setTimeout(() => btn.textContent = origText, 1500);
  });
});
