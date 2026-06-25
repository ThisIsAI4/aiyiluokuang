# ChatHub Replica（中文版）

> **语言：** [English](./README.md) | 简体中文

[Simple Chat Hub](https://chathub.aipilot.cc/) 的全功能 MV3 复刻版。将 30 个主流 AI 聊天平台聚合到同一个面板中，实现多平台同步聊天。

## 项目内容

### 架构
- **Manifest V3** 的 Chrome / Edge 扩展（`src/background.ts` 服务工作者）
- 通过 **`declarativeNetRequest`** 动态剥离 `X-Frame-Options` 和 `Content-Security-Policy`，使 AI 平台能够被嵌套进 iframe。
- 每个平台配备**两个 content script**：
  - `priority.js`（MAIN world，`document_start`）：屏蔽页面抢占焦点、移除 `autofocus`、把键盘快捷键转发给父页面。由 `scripts/build-priority.mjs` 预打包为自包含的 IIFE。
  - `main.ts`（ISOLATED world，`document_idle`）：接收来自父页面的 `sendText`、执行声明式动作、填充输入框、点击发送按钮，并协调长截图滚动。
- 扩展 UI 与 content script 之间通过 **PostMessage RPC** 通信（`{source: "chathub-replica", type, action, id, data}`）。
- **30 个内置平台**（16 个国际 + 14 个国内），各自可选 `inputSelector`、`sendButtonSelector`、`inputMethod`，以及声明式 `inputActions` / `sendActions` / `readyActions` / `newChatActions`、`scrollContainerSelector` 和 `networkRules`。

### 功能特性
- 多平台同步发送
- 布局预设（由所选平台组成的命名布局）
- 可配置列数
- 单平台刷新、全屏、新建对话
- **单图 + 长截图**（启发式滚动容器检测、隐藏固定元素、多 iframe 画布拼接）
- **提示词库**（支持增删改查的持久化提示词）
- **自定义平台**（添加 / 编辑你自己的 URL，可配置选择器和高级 JSON 配置）
- **可配置的键盘快捷键**，共 9 个动作：
  - `focusInput`、`newChat`、`optimizePrompt`、`closeChat`、`reloadChat`、`enterFullscreen`
  - 基于模式匹配：`insertPrompt #N`、`switchLayout #N`、`switchPlatformTab #N`
- 主题：跟随系统 / 浅色 / 深色
- 国际化：英文 + 简体中文（扩展已沿用原版完整的 12 语言结构）
- 自定义主色调
- 发送键模式：Enter 或 ⌘/Ctrl+Enter
- 单平台专属适配（如自动关闭 Grok 的 OneTrust 同意弹窗）

### 与原版对比
| | 原版 Simple Chat Hub 2.4.0 | 本复刻版 |
|---|---|---|
| Manifest | MV3 + 动态规则 + 动态脚本注入 | ✅ 相同 |
| 平台数 | 30 个内置 | ✅ 同样 30 个 |
| 多平台同步发送 | ✅ | ✅ |
| 长截图（多 iframe 拼接） | ✅ | ✅ |
| 提示词库 | ✅ | ✅ |
| 提示词优化 | 调用 `chathub.aipilot.cc/api`（每日 20 次） | ⚠️ 占位实现 —— 需自备 LLM Key |
| 自定义平台 | ✅ | ✅ |
| 9 个快捷动作 | ✅ | ✅ |
| 语言 | 12 种 | 英文 + 简体中文（已具备 12 种的结构） |
| 远程配置同步 | 定期从服务器拉取 | 未启用（仅使用内置配置） |

## v1.1 新功能 —— Spotlight 更新

- 在任意网页的选中文本上**右键「发送到 ChatHub」**。会预填到 ChatHub 输入框，从不自动发送。
- 在任意页面上**右键「总结此页面 / PDF」**。通过 Readability 提取正文（或 PDF 的前约 50 页）。预填到输入框，从不自动发送。
- 头部的**接龙模式（半自动接龙）**：定义一个有序的平台链路（例如 GPT → Claude → Gemini），向第 1 步发送提示词，在面板中选中文字后点击「下一步 ▶」即可喂给第 2 步。模板可编辑、支持命名预设、可中断 / 重启。

### 新增权限

| 权限 | 用途 |
|---|---|
| `contextMenus` | 注册两个右键菜单项。 |
| `notifications` | 以单行 toast 形式提示提取错误。 |
| `host_permissions: file:///*` | 用于总结本地 PDF（可选启用，见下文）。 |

### 本地 PDF 配置（一次性）

1. 打开 `chrome://extensions/`
2. 找到「ChatHub Replica」并点击「详情」
3. 打开**「允许访问文件网址」**开关
4. 此后右键本地 PDF 即可生成摘要。

在启用之前，右键本地 PDF 会弹出一个一次性的 toast，指向此说明。

## 构建与加载

```bash
cd chathub-replica
npm install          # 如果速度慢，可加 --registry=https://registry.npmmirror.com
npm run build
```

然后：
1. 打开 `chrome://extensions/`
2. 打开右上角的**开发者模式**
3. 点击**加载已解压的扩展程序** → 选择 `dist/` 目录
4. 点击扩展的工具栏图标即可打开 ChatHub 页面

## 项目结构

```
chathub-replica/
├─ package.json
├─ vite.config.ts
├─ manifest.config.ts          # 类型化的 CRXJS manifest
├─ scripts/
│  └─ build-priority.mjs       # 把 priority.ts 预构建为 IIFE（MAIN world 不需要 chrome.runtime）
├─ chatHub.html                # 主 UI 入口
├─ public/
│  └─ icons/                   # 16/32/48/128 PNG（占位图）
├─ _locales/{en,zh_CN}/        # MV3 扩展 i18n（名称 / 描述）
└─ src/
   ├─ background.ts            # SW：DNR 规则 + content script 注册 + 消息路由
   ├─ main.tsx, App.tsx
   ├─ contentScripts/
   │  ├─ priority.ts           # MAIN world：焦点 / autofocus / 快捷键 / Grok 同意弹窗
   │  └─ main.ts               # ISOLATED：sendText、动作引擎、截图协调
   ├─ platforms/
   │  ├─ configs.ts            # 30 个内置平台
   │  └─ configManager.ts      # 基础 + 自定义 + 缓存 + 合并配置
   ├─ utils/
   │  ├─ constants.ts          # 存储键、枚举、默认值
   │  ├─ messaging.ts          # PostMessage RPC + chrome.runtime 辅助函数
   │  ├─ dom.ts                # ActionEngine、fillInput、triggerSend、shadow-DOM 解析器
   │  ├─ screenshot.ts         # 滚动容器启发式、画布辅助、图像工具
   │  ├─ shortcuts.ts          # 9 个默认绑定、匹配器、格式化器
   │  └─ storage.ts            # chrome.storage.local 辅助函数、clientId
   ├─ services/
   │  └─ capture.ts            # 由父页面驱动的多 iframe 长截图拼接
   ├─ store/
   │  └─ index.ts              # zustand store：选项、bundle、提示词、快捷键、自定义
   ├─ locales/
   │  ├─ en.ts, zh-CN.ts       # UI i18n 语言包
   │  └─ index.ts              # i18next 初始化 + 自动检测
   ├─ components/
   │  ├─ ChatPanel.tsx         # 单个 iframe 面板 + 就绪信号 + RPC 桥接
   │  ├─ SettingsDrawer.tsx
   │  ├─ LayoutManager.tsx
   │  ├─ PromptLibraryModal.tsx
   │  ├─ CustomConfigModal.tsx
   │  └─ ShortcutModal.tsx
   └─ pages/
      └─ ChatHub.tsx           # 主视图：头部 + 布局标签 + iframe 网格 + 输入栏
```

## 关键实现说明

### 为什么需要两个 content script？
原版会在 `document_start` 阶段覆盖 `HTMLElement.prototype.focus` —— 这种原型补丁只能在 MAIN world 中生效。而填充输入框 / 点击发送按钮 / 发送文本的逻辑又需要 `chrome.runtime`，它只在 ISOLATED world 中可用。因此原版拆分了职责，本复刻版同样如此。

### 为什么 priority.js 要单独预打包？
CRXJS 2.0.0-beta.28 不支持以 IIFE 形式输出 content script。通过 `chrome.scripting.registerContentScripts` 加载的 MAIN world 脚本会以经典脚本方式执行（没有 ES 模块，也没有 `chrome.runtime.getURL`），因此必须是自包含的 IIFE。我们使用 esbuild 作为前置步骤生成 `public/priority.js`。

### 为什么 main.ts 没有 IIFE 问题？
通过 `chrome.scripting` 加载的 ISOLATED world content script 拥有可用的 `chrome.runtime.getURL`。CRXJS 默认的 `?script` 加载器模式可行：它会输出一个极小的 loader stub，用 `chrome.runtime.getURL` 动态导入真正的模块。

### 「发送到所有平台」是如何工作的？
每个 `ChatPanel` 都暴露一个 `sendText(text)` 命令式句柄。页面会收集所有可见面板并并行调用 `sendText`，流程如下：
1. 通过 `sendToIframe(iframeRef, 'sendText', {text})` → `window.postMessage` 发送到 iframe。
2. iframe 中的 `main.ts` 收到消息后，执行 `inputActions`，按配置的 `inputMethod` 填充输入框，然后或者点击配置的 `sendButtonSelector`，或者派发 Enter 事件。

### 平台如何在每次加载时自动配置（思考模型 + 联网搜索）？
每个平台配置都可以声明 `readyActions` —— iframe 中的 `main.ts` 会在聊天输入框出现后执行这些声明式动作，在**每次**页面加载和刷新时都会执行。有两种幂等的动作类型驱动「最优思考模型 + 工具」的目标：
- `ensureToggleOn` —— 通过 `selector` 或可见的 `buttonText`（候选字符串数组，由于这些站点使用哈希类名，按可见文本匹配）查找开关，检查它是否已经激活，**仅在关闭时**点击。这正是让联网搜索 / 深度思考保持开启、又不会在下次刷新时被切回关闭的关键。
- `selectByText` —— 打开模型选择器（`triggerText`）并按可见的 `optionText` 点击对应选项；当目标模型已被选中时，会通过 `currentLabel` / `currentText` 提前短路。

两者都安全降级：如果某个选择器或标签始终匹配不到，它们会超时并不做任何事 —— 站点保持原样。主集合之外站点的选择器 / 标签为尽力而为，可能需要随着平台 UI 变化进行实时调优。

### 长截图是如何工作的？
1. 父页面并行地对每个 iframe 调用 `captureStart` —— 每个 iframe 找到自己的滚动容器（启发式检测），隐藏固定 / 吸顶 / 绝对定位的覆盖元素，并返回其滚动指标。
2. 父页面计算输出画布的尺寸和聚合缩放比例。
3. 在一个循环中：父页面并行通知所有 iframe 执行 `triggerScroll(top)`，等待，调用 `chrome.tabs.captureVisibleTab`（通过 background），并将该帧拼接到输出画布对应的切片上。
4. 覆盖完整高度后，绘制头部横幅，对每个 iframe 调用 `captureEnd`（恢复滚动位置和先前隐藏的元素），然后在新标签页中打开结果。

## 限制 / TODO
- 提示词优化目前会弹出一个「请配置本地 LLM Key」的 toast。请将其接入后端或本地 API（位于 `services/`），并更新 `ChatHub.tsx` 中的 optimizePrompt 处理函数。
- 远程配置更新接口已省略 —— 内置 bundle 是唯一事实来源。
- 仅包含英文 + 简体中文的 UI 翻译。可在 `src/locales/` 下添加其他语言。
- 图标为 1×1 占位图 —— 请在 `public/icons/` 下替换。
- 部分平台（如 ChatGPT、Claude、Gemini）会主动检测 iframe 嵌入，并可能随时间失效。`inputActions` / `sendActions` 配置层正是为此而设的变通入口 —— 可随平台变化进行扩展。
