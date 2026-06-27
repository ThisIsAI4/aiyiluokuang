import { describe, it, expect, beforeEach } from 'vitest';
import { harvestAnswer } from '../harvestAnswer';
import type { ChatAppConfig } from '../../types';

const cfg = (over: Partial<ChatAppConfig> = {}): ChatAppConfig =>
  ({ id: 'X', url: 'https://x.test', ...over });

function setBody(html: string): void { document.body.innerHTML = html; }
function selectNode(el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

beforeEach(() => {
  setBody('');
  window.getSelection()?.removeAllRanges();
});

describe('harvestAnswer', () => {
  it('returns the user selection first, overriding any auto-detected answer', () => {
    setBody('<div data-message-author-role="assistant">auto answer</div><p id="hi">hand-picked</p>');
    selectNode(document.getElementById('hi')!);
    expect(harvestAnswer(cfg())).toBe('hand-picked');
  });

  it('uses answerSelector (last visible match) when nothing is selected', () => {
    setBody(`
      <div class="msg">first answer</div>
      <div class="msg" style="display:none">hidden one</div>
      <div class="msg">latest answer</div>
    `);
    expect(harvestAnswer(cfg({ answerSelector: '.msg' }))).toBe('latest answer');
  });

  it('falls back to the generic heuristic when no selection and no answerSelector', () => {
    setBody(`
      <div class="markdown">old answer</div>
      <div data-message-author-role="assistant">the newest answer</div>
    `);
    // No answerSelector configured — generic heuristic must still find the assistant turn.
    expect(harvestAnswer(cfg())).toBe('the newest answer');
  });

  it('returns empty string when nothing is selectable (so the orchestrator no-ops)', () => {
    setBody('<p>not an answer</p>');
    expect(harvestAnswer(cfg({ answerSelector: '.does-not-exist' }))).toBe('');
  });
});
