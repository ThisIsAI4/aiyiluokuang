import type { AppConfigBundle, ChatAppConfig } from '../types';

export const BUILTIN_CONFIG_VERSION = '26060610';

export const BUILTIN_CHAT_APPS: ChatAppConfig[] = [
  // International
  { id: 'Copilot', url: 'https://copilot.microsoft.com/' },
  { id: 'CopilotGH', url: 'https://github.com/copilot' },
  { id: 'Felo', url: 'https://felo.ai/search' },
  { id: 'Genspark', url: 'https://www.genspark.ai/' },
  {
    id: 'Liner',
    url: 'https://app.liner.com/',
    sendActions: [
      {
        type: 'findAndSetDataId',
        params: {
          selector: [
            "[data-label=answer-ai-input-submit-button] button",
            "[data-label='answer-container'] > div:last-child button:not([type])",
          ],
          dataId: 'send-button',
        },
      },
    ],
    sendButtonSelector: "[data-id='send-button']",
  },
  { id: 'Perplexity', url: 'https://www.perplexity.ai/', inputMethod: 'paste',
    // Web search is intrinsic; the strongest mode is "Research" (deep research).
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['Research', 'Pro', '研究'] } },
    ],
  },
  { id: 'You', url: 'https://you.com/' },
  { id: 'ChatGPT', url: 'https://chatgpt.com/', inputSelector: '#prompt-textarea',
    answerSelector: '[data-message-author-role="assistant"]:last-of-type .markdown, [data-message-author-role="assistant"]',
    // Goal: web search on. "Search" lives in the composer tools; Thinking is model-driven.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['Search', 'Search the web', '搜索'] } },
    ],
  },
  {
    id: 'Claude',
    url: 'https://claude.ai/',
    answerSelector: '.font-claude-message, [data-testid="bot-message"]',
    // Goal: web search + extended thinking on. Both are user toggles in claude.ai.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['Web search', '网络搜索', '联网搜索'] } },
      { type: 'ensureToggleOn', params: { buttonText: ['Extended', 'Extended thinking', '扩展思考'] } },
    ],
    sendActions: [
      {
        type: 'findLastAndSetDataId',
        params: {
          selector: 'button',
          rootSelector: '[type=file] ~ .relative',
          dataId: 'send-button',
        },
      },
    ],
    sendButtonSelector: "[data-id='send-button']",
  },
  { id: 'Gemini', url: 'https://gemini.google.com/app',
    answerSelector: 'message-content, .model-response-text',
    // Goal: strongest reasoning. "Thinking"/"Deep Think" selected via the model/prompt bar; best-effort.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['Deep Think', 'Thinking', '深度思考'] } },
    ],
  },
  { id: 'Grok', url: 'https://grok.com/',
    answerSelector: '[data-testid="message-bot"], .markdown',
    // Goal: web search + reasoning. Grok exposes "DeepSearch" and "Think" buttons.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['Think', '思考'] } },
      { type: 'ensureToggleOn', params: { buttonText: ['DeepSearch', 'DeeperSearch', 'Search'] } },
    ],
  },
  { id: 'Meta', url: 'https://www.meta.ai/', inputMethod: 'paste' },
  { id: 'Mistral', url: 'https://chat.mistral.ai/chat', firefoxInputMethod: 'text' },
  { id: 'Poe', url: 'https://poe.com/' },
  { id: 'QwenChat', url: 'https://chat.qwen.ai/', inputSelector: 'textarea.message-input-textarea', inputMethod: 'input' },
  { id: 'Zai', url: 'https://chat.z.ai/', inputSelector: 'textarea#chat-input', inputMethod: 'input',
    // Goal: enable web search by default. z.ai is web-component/shadow-DOM heavy and the
    // search control may be icon-only (no text) — verify the live label/selector.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['Web Search', '联网搜索', 'Search', '网络搜索', '联网'] } },
    ],
  },
  // Chinese
  { id: 'MetaSo', url: 'https://metaso.cn/' },
  {
    id: 'NaMiSearch',
    url: 'https://www.n.cn/',
    inputMethod: 'paste',
    sendButtonSelector: '.send-btn',
  },
  { id: 'ChatGLM', url: 'https://chatglm.cn/',
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['深度思考', '沉思'] } },
      { type: 'ensureToggleOn', params: { buttonText: ['联网搜索', '联网'] } },
    ],
  },
  { id: 'DeepSeek', url: 'https://chat.deepseek.com/', inputSelector: 'textarea', inputMethod: 'input',
    answerSelector: '.ds-markdown, .markdown',
    // Goal: "Expert"-level answers + tools. DeepSeek has no literal "Expert" mode in the
    // chat UI; the strongest setting is DeepThink (reasoning) + web search both on.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['深度思考', '深度思考 (R1)', 'DeepThink'] } },
      { type: 'ensureToggleOn', params: { buttonText: ['联网搜索', 'Search'] } },
    ],
  },
  { id: 'DouBao', url: 'https://www.doubao.com/', inputSelector: 'textarea.semi-input-textarea', inputMethod: 'input',
    // Goal: 专家 mode. DouBao's mode switcher is a <button> pill; clicking it opens a
    // <menuitem> list (快速 / 专家 / 任务). Pick 专家. Idempotent: selectByText bails
    // when the trigger already reads 专家, so refreshes are no-ops.
    readyActions: [
      { type: 'selectByText', params: { triggerText: ['快速', '思考', '专家', '任务'], optionText: '专家', includeNonSemantic: true, menuDelay: 500 } },
    ],
  },
  { id: 'HaiLuo', url: 'https://agent.minimaxi.com/', inputMethod: 'text' },
  { id: 'HunYuan', url: 'https://yuanbao.tencent.com/', inputSelector: '.ql-editor', inputMethod: 'paste',
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['深度思考', 'DeepSeek'] } },
      { type: 'ensureToggleOn', params: { buttonText: ['联网搜索', '联网'] } },
    ],
  },
  { id: 'Kimi', url: 'https://www.kimi.com/', inputSelector: '.chat-input-editor', inputMethod: 'paste',
    answerSelector: '.chat-content-item, .markdown',
    // Kimi uses 长思考 (not 深度思考) and 联网, inside the 工具箱.
    readyActions: [
      { type: 'ensureToggleOn', params: { buttonText: ['长思考', '深度思考', 'Long Thinking'] } },
      { type: 'ensureToggleOn', params: { buttonText: ['联网', '联网搜索', 'Search'] } },
    ],
  },
  { id: 'LingGuang', url: 'https://www.lingguang.com/chat' },
  { id: 'LongCat', url: 'https://longcat.chat/', inputSelector: '.ProseMirror', inputMethod: 'paste' },
  { id: 'Qwen', url: 'https://www.qianwen.com/', inputMethod: 'paste' },
  { id: 'SenseChat', url: 'https://chat.sensetime.com/', inputSelector: 'textarea.ant-input', inputMethod: 'input' },
  { id: 'YiYan', url: 'https://yiyan.baidu.com/', inputMethod: 'paste' },
  {
    id: 'YueWen',
    url: 'https://www.stepfun.com/',
    sendActions: [
      {
        type: 'findParentAndSetDataId',
        params: { selector: '.custom-icon-send-outline', dataId: 'send-button' },
      },
    ],
    sendButtonSelector: "[data-id='send-button']",
  },
];

export const BUILTIN_CHAT_GROUPS = [
  {
    id: 'international',
    chatAppIds: [
      'ChatGPT', 'Claude', 'Copilot', 'CopilotGH', 'Felo', 'Gemini', 'Genspark',
      'Grok', 'Liner', 'Meta', 'Mistral', 'Perplexity', 'Poe', 'QwenChat', 'You', 'Zai',
    ],
  },
  {
    id: 'chinese',
    chatAppIds: [
      'ChatGLM', 'DeepSeek', 'DouBao', 'YiYan', 'Kimi', 'LingGuang', 'LongCat',
      'MetaSo', 'HaiLuo', 'NaMiSearch', 'Qwen', 'SenseChat', 'YueWen', 'HunYuan',
    ],
  },
];

export const BUILTIN_BUNDLE: AppConfigBundle = {
  version: BUILTIN_CONFIG_VERSION,
  chatApps: BUILTIN_CHAT_APPS,
  chatGroups: BUILTIN_CHAT_GROUPS,
};

export const PLATFORM_DISPLAY: Record<string, { name: string; company: string }> = {
  ChatGPT: { name: 'ChatGPT', company: 'OpenAI' },
  Claude: { name: 'Claude', company: 'Anthropic' },
  Gemini: { name: 'Gemini', company: 'Google' },
  Grok: { name: 'Grok', company: 'xAI' },
  Copilot: { name: 'Copilot', company: 'Microsoft' },
  CopilotGH: { name: 'GitHub Copilot', company: 'GitHub' },
  DeepSeek: { name: 'DeepSeek', company: 'DeepSeek' },
  Poe: { name: 'Poe', company: 'Quora' },
  Perplexity: { name: 'Perplexity', company: 'Perplexity' },
  Kimi: { name: 'Kimi', company: 'Moonshot' },
  DouBao: { name: '豆包', company: 'ByteDance' },
  Qwen: { name: '通义千问', company: 'Alibaba' },
  QwenChat: { name: 'Qwen Chat', company: 'Alibaba' },
  Mistral: { name: 'Le Chat', company: 'Mistral' },
  Meta: { name: 'Meta AI', company: 'Meta' },
  Felo: { name: 'Felo', company: 'Felo' },
  Genspark: { name: 'Genspark', company: 'Genspark' },
  Liner: { name: 'Liner', company: 'Liner' },
  You: { name: 'You', company: 'You.com' },
  Zai: { name: 'Z.ai', company: 'Zhipu' },
  ChatGLM: { name: 'ChatGLM', company: 'Zhipu' },
  HaiLuo: { name: '海螺', company: 'MiniMax' },
  HunYuan: { name: '腾讯元宝', company: 'Tencent' },
  LingGuang: { name: '灵光', company: 'Ant' },
  LongCat: { name: 'LongCat', company: 'Meituan' },
  MetaSo: { name: '秘塔', company: 'MetaSo' },
  NaMiSearch: { name: '纳米搜索', company: '360' },
  SenseChat: { name: '商量', company: 'SenseTime' },
  YiYan: { name: '文心一言', company: 'Baidu' },
  YueWen: { name: '跃问', company: 'StepFun' },
};
