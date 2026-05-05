// Knexio 阅读伴侣 — popup.js

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
  
  if (!input) { resultBox.textContent = '请先输入文字'; return; }
  if (input.length > 5000) { resultBox.textContent = '文字太长，最多 5000 字'; return; }
  
  resultBox.textContent = '⏳ 翻译中...';
  actions.style.display = 'none';
  
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(input)}`);
    const data = await res.json();
    const translated = data[0].map(x => x[0]).join('');
    resultBox.textContent = translated;
    actions.style.display = 'block';
  } catch (e) {
    resultBox.textContent = '翻译失败：' + e.message;
  }
});

// ── Summarize ──
let hasApiKey = false;
let currentPageText = '';

chrome.storage.sync.get(['deepseek_api_key'], async (items) => {
  if (items.deepseek_api_key) {
    hasApiKey = true;
    document.getElementById('summarize-status').innerHTML = '<span class="status-icon">🟢</span> 智能摘句就绪 · AI 深度总结已解锁';
    document.getElementById('ai-summarize-btn').style.display = 'block';
  } else {
    document.getElementById('summarize-status').innerHTML = '<span class="status-icon">🟡</span> 智能摘句就绪 · <a href="options.html" target="_blank" style="color:#4f8ff7">配置 DeepSeek</a> 解锁 AI 深度总结';
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
  if (!paras.length) return '页面内容较少，无法提取摘要';
  if (paras.length <= 4) return '📄 ' + data.title + '\n\n' + paras.join('\n\n');
  
  // Score each paragraph
  const sentences = [];
  paras.forEach((p, i) => {
    // Split long paragraphs into sentences
    const parts = p.split(/(?<=[。！？.!?])\s*/).filter(s => s.length > 10);
    parts.forEach((s, j) => {
      sentences.push({ text: s, paraIdx: i, posInPara: j });
    });
  });
  
  if (sentences.length <= 5) return '📄 ' + data.title + '\n\n' + sentences.map(s => s.text).join(' ');
  
  // Build word frequency for keyword scoring
  const wordFreq = {};
  sentences.forEach(s => {
    s.text.split(/[，。！？,\.!?\s]+/).forEach(w => {
      if (w.length >= 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
  });
  const totalSentences = sentences.length;
  
  // Score each sentence
  sentences.forEach((s, i) => {
    let score = 0;
    
    // Position: earlier sentences are more important
    score += 2.0 / Math.sqrt(i / 2 + 1);
    
    // Length: prefer 40-150 char sentences
    const len = s.text.length;
    if (len > 40 && len < 150) score += 1.5;
    else if (len < 20 || len > 250) score -= 1;
    
    // Keyword density: how many frequent words appear
    const words = s.text.split(/[，。！？,\.!?\s]+/).filter(w => w.length >= 3);
    let kwScore = 0;
    words.forEach(w => {
      if (wordFreq[w] && wordFreq[w] > 1) kwScore += Math.min(wordFreq[w] / totalSentences * 5, 1);
    });
    score += kwScore / Math.max(words.length, 1) * 3;
    
    // Title overlap boost
    if (data.title) {
      const titleWords = new Set(data.title.split(/[\s]+/).filter(w => w.length >= 2));
      words.forEach(w => { if (titleWords.has(w)) score += 0.5; });
    }
    
    s.score = score;
  });
  
  // Pick top N, keep original order
  const topN = Math.min(8, Math.max(4, Math.floor(sentences.length * 0.3)));
  sentences.sort((a, b) => b.score - a.score);
  const picked = sentences.slice(0, topN);
  picked.sort((a, b) => a.paraIdx - b.paraIdx || a.posInPara - b.posInPara);
  
  return '📄 ' + data.title + '\n\n' + picked.map(s => s.text).join(' ');
}

// Smart extract button — always works
document.getElementById('summarize-btn').addEventListener('click', async () => {
  const btn = document.getElementById('summarize-btn');
  const resultBox = document.getElementById('summarize-result');
  
  btn.disabled = true;
  btn.textContent = '⏳ 分析页面内容...';
  resultBox.textContent = '';
  document.getElementById('summarize-actions').style.display = 'none';
  
  try {
    const data = await extractPageContent();
    if (!data || !data.paragraphs.length) {
      resultBox.textContent = '页面内容太少，无法提取摘要';
      btn.textContent = '智能摘句';
      btn.disabled = false;
      return;
    }
    currentPageText = data.fullText;
    resultBox.textContent = buildExtractiveSummary(data);
    btn.textContent = '智能摘句';
    btn.disabled = false;
    document.getElementById('summarize-actions').style.display = 'block';
  } catch (e) {
    resultBox.textContent = '提取失败：' + e.message;
    btn.textContent = '智能摘句';
    btn.disabled = false;
  }
});

// AI summary button — needs DeepSeek key
document.getElementById('ai-summarize-btn').addEventListener('click', async () => {
  const btn = document.getElementById('ai-summarize-btn');
  const resultBox = document.getElementById('summarize-result');
  
  btn.disabled = true;
  btn.textContent = '⏳ AI 思考中...';
  
  try {
    if (!currentPageText) {
      const data = await extractPageContent();
      currentPageText = data?.fullText || '';
    }
    
    if (currentPageText.length < 100) {
      resultBox.textContent = '页面内容太少，无法生成 AI 摘要';
      btn.textContent = '✨ AI 深度总结';
      btn.disabled = false;
      return;
    }
    
    const { deepseek_api_key } = await chrome.storage.sync.get(['deepseek_api_key']);
    if (!deepseek_api_key) {
      resultBox.textContent = '请先在设置页配置 DeepSeek API Key';
      btn.textContent = '✨ AI 深度总结';
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
    if (data.error) throw new Error(data.error.message || 'API 错误');
    resultBox.textContent = data.choices[0].message.content;
    btn.textContent = '✨ AI 深度总结';
    btn.disabled = false;
    document.getElementById('summarize-actions').style.display = 'block';
    
  } catch (e) {
    resultBox.textContent = 'AI 摘要失败：' + e.message;
    btn.textContent = '✨ AI 深度总结';
    btn.disabled = false;
  }
});

// ── Save ──
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('save-title').textContent = tab.title;
  document.getElementById('save-url').textContent = tab.url;
})();

document.getElementById('save-btn').addEventListener('click', async () => {
  const resultBox = document.getElementById('save-result');
  resultBox.textContent = '⚠️ 保存到 Knexio 功能需要后端支持，当前为占位。可通过 knexio.xyz 手动添加书签。';
});

// ── Copy buttons ──
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    navigator.clipboard.writeText(target.textContent);
    btn.textContent = '已复制 ✓';
    setTimeout(() => btn.textContent = '复制结果', 1500);
  });
});
