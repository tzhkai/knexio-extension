// i18n — shared translations for Knexio 阅读伴侣
const I18N = {
  _lang: (navigator.language || 'en').startsWith('zh') ? 'zh' : 'en',

  t(key) {
    const str = I18N._data[I18N._lang]?.[key] || I18N._data['en']?.[key] || key;
    if (typeof str === 'function') return str();
    return str;
  },

  _data: {
    zh: {
      // ── General ──
      app_name: 'Knexio 阅读伴侣',
      translate: '📝 翻译',
      summarize: '🤖 摘要',
      md_tab: '📝 转 MD',
      settings: '⚙️ 设置',
      copy: '复制',
      copied: '已复制 ✓',
      close: '✕',
      translate_btn: '翻译',
      translating: '翻译中…',
      translated: '已翻译',
      translate_failed: '翻译失败',

      // ── Translate tab ──
      translate_to_zh: '翻译成 中文',
      translate_to_en: '翻译成 English',
      translate_to_ja: '翻译成 日本語',
      translate_to_ko: '翻译成 한국어',
      translate_to_fr: '翻译成 Français',
      translate_to_de: '翻译成 Deutsch',
      translate_to_es: '翻译成 Español',
      translate_to_ru: '翻译成 Русский',
      translate_input_hint: '输入文字，或选中网页文字后点右键翻译...',
      copy_result: '复制结果',

      // ── Summarize tab ──
      summarize_ready: '智能摘句就绪',
      summarize_ready_ai: '智能摘句就绪 · AI 深度总结已解锁',
      summarize_ready_no_ai: '智能摘句就绪 · 配置 DeepSeek 解锁 AI 深度总结',
      summarize_hint: '右键页面任意位置 →「✂️ 智能摘句」或点击下方按钮。配置 DeepSeek 后解锁 AI 语义级总结。',
      summarize_btn: '智能摘句',
      ai_summarize_btn: '✨ AI 深度总结',
      summarize_analyzing: '⏳ 分析页面内容...',
      summarize_no_content: '页面内容太少，无法提取摘要',
      summarize_extract_fail: '提取失败',
      summarize_ai_thinking: '⏳ AI 思考中...',
      summarize_ai_no_content: '页面内容太少，无法生成 AI 摘要',
      summarize_ai_no_key: '请先在设置页配置 DeepSeek API Key',
      summarize_ai_fail: 'AI 摘要失败',
      summarize_translate_btn: '🌐 翻译',
      summarize_original_btn: '查看原文',

      // ── Save tab ──
      md_hint: '提取正文为 Markdown，免费在线编辑器打开 ✨',
      md_hint_summary: '已检测到摘要 ✅ 将一并发送到编辑器',
      save_title_label: '标题',
      save_url_label: '链接',
      md_btn: '打开编辑器',
      md_extracting: '提取中…',
      md_ok: '已复制 ✓ 即将打开编辑器',
      md_fail: '提取失败，页面内容可能较少或受限制',

      // ── Content script (floating button) ──
      float_translate: '🔤 翻译',
      float_translating: '翻译中…',

      // ── Background (context menu) ──
      ctx_translate: '🔤 翻译选中文字',
      ctx_summarize: '✂️ 智能摘句',
      popup_translating: '翻译中…',
      popup_translate_title: '翻译选中文字',
      popup_summary_title: '智能摘句 · 本页摘要',

      // ── Options ──
      options_title: 'Knexio 阅读伴侣 — 设置',
      options_api_key: 'DeepSeek API Key',
      options_api_key_hint: '获取 API Key：platform.deepseek.com → API Keys → 创建，新用户免费 500 万 tokens',
      options_save: '保存',
      options_clear: '清除',
      options_saved: '已保存',
      options_enter_key: '请输入 API Key',
      options_default_lang: '默认翻译语言',
      options_usage: '使用说明',
      options_usage_text: '安装后直接在网页上选中文字，右键即可翻译或摘句。点击工具栏图标使用完整功能。AI 深度总结需要配置 DeepSeek API Key。',
      options_version: '版本',
      lang_zh: '中文（简体）',
      lang_en: 'English',
      lang_ja: '日本語',
      lang_ko: '한국어',
      lang_fr: 'Français',
      lang_de: 'Deutsch',
      lang_es: 'Español',
      lang_ru: 'Русский',
    },

    en: {
      // ── General ──
      app_name: 'Knexio Companion',
      translate: '📝 Translate',
      summarize: '🤖 Summary',
      md_tab: '📝 To MD',
      settings: '⚙️ Settings',
      copy: 'Copy',
      copied: 'Copied ✓',
      close: '✕',
      translate_btn: 'Translate',
      translating: 'Translating…',
      translated: 'Translated',
      translate_failed: 'Translation failed',

      // ── Translate tab ──
      translate_to_zh: 'to 中文',
      translate_to_en: 'to English',
      translate_to_ja: 'to 日本語',
      translate_to_ko: 'to 한국어',
      translate_to_fr: 'to Français',
      translate_to_de: 'to Deutsch',
      translate_to_es: 'to Español',
      translate_to_ru: 'to Русский',
      translate_input_hint: 'Type text, or select text on page and right-click...',
      copy_result: 'Copy Result',

      // ── Summarize tab ──
      summarize_ready: 'Smart Extract ready',
      summarize_ready_ai: 'Smart Extract ready · AI Summary unlocked',
      summarize_ready_no_ai: 'Smart Extract ready · Add DeepSeek key for AI summary',
      summarize_hint: 'Right-click anywhere on page →「✂️ Smart Extract」or click below. Add DeepSeek key for AI-powered summary.',
      summarize_btn: 'Smart Extract',
      ai_summarize_btn: '✨ AI Summary',
      summarize_analyzing: '⏳ Analyzing page...',
      summarize_no_content: 'Page has too little content to summarize',
      summarize_extract_fail: 'Extract failed',
      summarize_ai_thinking: '⏳ AI thinking...',
      summarize_ai_no_content: 'Page has too little content for AI summary',
      summarize_ai_no_key: 'Please add your DeepSeek API Key in Settings',
      summarize_ai_fail: 'AI summary failed',
      summarize_translate_btn: '🌐 Translate',
      summarize_original_btn: 'Show Original',

      // ── Save tab ──
      md_hint: 'Extract page as Markdown, open in free online editor ✨',
      md_hint_summary: 'Summary detected ✅ will be included',
      save_title_label: 'Title',
      save_url_label: 'URL',
      md_btn: 'Open Editor',
      md_extracting: 'Extracting…',
      md_ok: 'Copied ✓ Opening editor…',
      md_fail: 'Extraction failed. Page content may be too thin or restricted.',

      // ── Content script (floating button) ──
      float_translate: '🔤 Translate',
      float_translating: 'Translating…',

      // ── Background (context menu) ──
      ctx_translate: '🔤 Translate Selection',
      ctx_summarize: '✂️ Smart Extract',
      popup_translating: 'Translating…',
      popup_translate_title: 'Translate Selection',
      popup_summary_title: 'Smart Extract · Page Summary',

      // ── Options ──
      options_title: 'Knexio Companion — Settings',
      options_api_key: 'DeepSeek API Key',
      options_api_key_hint: 'Get your key: platform.deepseek.com → API Keys → Create. New users get 5M free tokens.',
      options_save: 'Save',
      options_clear: 'Clear',
      options_saved: 'Saved',
      options_enter_key: 'Please enter an API Key',
      options_default_lang: 'Default Target Language',
      options_usage: 'Usage',
      options_usage_text: 'Select text on any page and right-click to translate or extract a summary. Click the toolbar icon for full features. AI summary requires a DeepSeek API Key.',
      options_version: 'Version',
      lang_zh: 'Chinese (Simplified)',
      lang_en: 'English',
      lang_ja: 'Japanese',
      lang_ko: 'Korean',
      lang_fr: 'French',
      lang_de: 'German',
      lang_es: 'Spanish',
      lang_ru: 'Russian',
    }
  }
};
