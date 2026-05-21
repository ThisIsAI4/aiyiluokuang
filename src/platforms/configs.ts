import type { AppConfigBundle, ChatAppConfig } from '../types';

export const BUILTIN_CONFIG_VERSION = '26050601';

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
  { id: 'Perplexity', url: 'https://www.perplexity.ai/', inputMethod: 'paste' },
  { id: 'You', url: 'https://you.com/' },
  { id: 'ChatGPT', url: 'https://chatgpt.com/', inputSelector: '#prompt-textarea' },
  {
    id: 'Claude',
    url: 'https://claude.ai/',
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
  { id: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'Grok', url: 'https://grok.com/' },
  { id: 'Meta', url: 'https://www.meta.ai/', inputMethod: 'paste' },
  { id: 'Mistral', url: 'https://chat.mistral.ai/chat', firefoxInputMethod: 'text' },
  { id: 'Poe', url: 'https://poe.com/' },
  { id: 'QwenChat', url: 'https://chat.qwen.ai/', inputSelector: 'textarea.message-input-textarea', inputMethod: 'input' },
  { id: 'Zai', url: 'https://chat.z.ai/', inputSelector: 'textarea#chat-input', inputMethod: 'input' },
  // Chinese
  { id: 'MetaSo', url: 'https://metaso.cn/' },
  {
    id: 'NaMiSearch',
    url: 'https://www.n.cn/',
    inputMethod: 'paste',
    sendButtonSelector: '.send-btn',
  },
  { id: 'ChatGLM', url: 'https://chatglm.cn/' },
  { id: 'DeepSeek', url: 'https://chat.deepseek.com/', inputSelector: 'textarea', inputMethod: 'input' },
  { id: 'DouBao', url: 'https://www.doubao.com/', inputSelector: 'textarea.semi-input-textarea', inputMethod: 'input' },
  { id: 'HaiLuo', url: 'https://agent.minimaxi.com/', inputMethod: 'text' },
  { id: 'HunYuan', url: 'https://yuanbao.tencent.com/', inputSelector: '.ql-editor', inputMethod: 'paste' },
  { id: 'Kimi', url: 'https://www.kimi.com/', inputSelector: '.chat-input-editor', inputMethod: 'paste' },
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
