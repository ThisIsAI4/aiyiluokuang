import { describe, it, expect, beforeEach } from 'vitest';
import { run } from '../extractor';

function setBody(html: string, title = 'Test'): void {
  document.title = title;
  document.body.innerHTML = html;
  Object.defineProperty(document, 'contentType', { value: 'text/html', configurable: true });
}

beforeEach(() => {
  setBody('');
  window.getSelection()?.removeAllRanges();
});

describe('extractor', () => {
  it('returns kind=selection when text is selected', async () => {
    setBody('<p id="x">Hello world body</p>');
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('x')!);
    window.getSelection()!.addRange(range);
    const out = await run('auto');
    expect('text' in out && out.kind).toBe('selection');
    expect('text' in out && out.text).toContain('Hello world body');
  });

  it('forces kind=selection when kind=selection requested even with no selection (falls back to error)', async () => {
    setBody('<article>plenty of body text here for the article</article>');
    const out = await run('selection');
    expect('error' in out).toBe(true);
  });

  it('uses Readability for articles', async () => {
    setBody(
      '<article><h1>Title</h1>' +
      Array.from({ length: 20 }, (_, i) => `<p>Paragraph ${i} with enough text to count as content.</p>`).join('') +
      '</article>',
      'Big article',
    );
    const out = await run('auto');
    expect('text' in out && out.kind).toBe('article');
    expect('text' in out && out.text.length).toBeGreaterThan(200);
    expect('text' in out && out.sourceTitle).toBe('Big article');
  });

  it('falls back to innerText when Readability yields too little', async () => {
    setBody('<div>tiny</div>');
    const out = await run('auto');
    expect('text' in out && out.kind).toBe('article');
    expect('text' in out && out.text).toContain('tiny');
  });

  it('truncates to 8000 chars and marks truncated', async () => {
    const big = 'x'.repeat(9000);
    setBody(`<article>${big}</article>`);
    const out = await run('auto');
    expect('text' in out && out.text.length).toBe(8000);
    expect('truncated' in out && out.truncated).toBe(true);
  });
});
