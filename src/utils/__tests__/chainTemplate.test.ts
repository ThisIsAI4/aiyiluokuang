import { describe, it, expect } from 'vitest';
import { assembleChainPrompt, DEFAULT_CHAIN_TEMPLATE } from '../chainTemplate';

describe('chainTemplate', () => {
  it('substitutes {prompt} {harvested} {prevPlatform}', () => {
    const out = assembleChainPrompt(
      'Tmpl: {prompt} / {harvested} / from {prevPlatform}',
      { prompt: 'Why?', harvested: 'Because.', prevPlatform: 'GPT' },
    );
    expect(out).toBe('Tmpl: Why? / Because. / from GPT');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(
      assembleChainPrompt('keep {unknown} as-is', { prompt: 'x', harvested: 'y', prevPlatform: 'z' }),
    ).toBe('keep {unknown} as-is');
  });

  it('replaces multiple occurrences of the same variable', () => {
    expect(
      assembleChainPrompt('{prompt} -> {prompt}', { prompt: 'q', harvested: '', prevPlatform: '' }),
    ).toBe('q -> q');
  });

  it('default template includes both prompt and harvested', () => {
    const out = assembleChainPrompt(DEFAULT_CHAIN_TEMPLATE, {
      prompt: 'P', harvested: 'H', prevPlatform: 'GPT',
    });
    expect(out).toContain('P');
    expect(out).toContain('H');
    expect(out).toContain('GPT');
  });
});
