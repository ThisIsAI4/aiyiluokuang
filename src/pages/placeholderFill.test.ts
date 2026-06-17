import { describe, it, expect } from 'vitest';
import { resolveArrowRightFill } from './placeholderFill';

// 基础入参：默认就是一个"应该触发填入"的空输入场景，各用例按需覆盖单个字段。
const base = {
  key: 'ArrowRight',
  text: '',
  lastSent: '',
  historyOpen: false,
  defaultPlaceholder: '提示语',
};

describe('resolveArrowRightFill', () => {
  it('空输入框 + 有上次发送内容 → 填入上次内容（一键恢复重发/编辑）', () => {
    expect(resolveArrowRightFill({ ...base, lastSent: '你好' })).toBe('你好');
  });

  it('空输入框 + 无上次发送内容 → 填入默认 placeholder 提示语', () => {
    expect(resolveArrowRightFill({ ...base, defaultPlaceholder: 'Ask anything…' })).toBe('Ask anything…');
  });

  it('输入框已有内容 → 不触发，返回 null（保留 → 的正常光标右移）', () => {
    expect(resolveArrowRightFill({ ...base, text: '正在输入' })).toBeNull();
  });

  it('历史弹窗打开 → 不触发，返回 null（避免与弹窗按键冲突）', () => {
    expect(resolveArrowRightFill({ ...base, historyOpen: true })).toBeNull();
  });

  it('非 → 键 → 不触发，返回 null', () => {
    expect(resolveArrowRightFill({ ...base, key: 'ArrowLeft' })).toBeNull();
    expect(resolveArrowRightFill({ ...base, key: 'Enter' })).toBeNull();
  });
});
