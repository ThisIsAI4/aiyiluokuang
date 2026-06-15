import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionEngine } from '../dom';

beforeEach(() => {
  document.body.innerHTML = '';
});

// jsdom lacks layout, so isVisible()'s getBoundingClientRect() returns 0×0 and would
// hide every element. Stub it to "visible" so the text/state logic is what's tested.
function makeVisible() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 100, height: 30, top: 10, left: 0, right: 100, bottom: 40, x: 0, y: 10, toJSON: () => ({}),
  } as DOMRect);
}

describe('ensureToggleOn', () => {
  it('clicks an off toggle found by visible text', async () => {
    makeVisible();
    const onClick = vi.fn();
    document.body.innerHTML = '<button id="search" aria-pressed="false">联网搜索</button>';
    document.getElementById('search')!.addEventListener('click', onClick);

    await ActionEngine.exec({
      type: 'ensureToggleOn',
      params: { buttonText: '联网搜索', activeAttr: 'aria-pressed' },
    });
    expect(onClick).toHaveBeenCalled();
  });

  it('is idempotent: does NOT click a toggle that is already on', async () => {
    makeVisible();
    const onClick = vi.fn();
    document.body.innerHTML = '<button id="search" aria-pressed="true">联网搜索</button>';
    document.getElementById('search')!.addEventListener('click', onClick);

    await ActionEngine.exec({
      type: 'ensureToggleOn',
      params: { buttonText: '联网搜索', activeAttr: 'aria-pressed' },
    });
    // Re-running readyActions must not flip an enabled toggle back off.
    expect(onClick).not.toHaveBeenCalled();
  });

  it('detects active state via activeClass on the clickable ancestor', async () => {
    makeVisible();
    const onClick = vi.fn();
    document.body.innerHTML =
      '<button id="t" class="btn is-on"><span>Search</span></button>';
    document.getElementById('t')!.addEventListener('click', onClick);

    await ActionEngine.exec({
      type: 'ensureToggleOn',
      params: { buttonText: 'Search', activeClass: 'is-on' },
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fails safe when the toggle never appears (no throw)', async () => {
    makeVisible();
    await expect(
      ActionEngine.exec({
        type: 'ensureToggleOn',
        params: { buttonText: 'does-not-exist', timeout: 50 },
      }),
    ).resolves.toBeUndefined();
  });

  it('checks an external activeSelector instead of the toggle itself', async () => {
    makeVisible();
    const onClick = vi.fn();
    document.body.innerHTML =
      '<button id="t">Deep Think</button><div class="badge-active"></div>';
    document.getElementById('t')!.addEventListener('click', onClick);

    await ActionEngine.exec({
      type: 'ensureToggleOn',
      params: { buttonText: 'Deep Think', activeSelector: '.badge-active' },
    });
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('selectByText', () => {
  it('opens the trigger and clicks the matching option', async () => {
    makeVisible();
    const optionClick = vi.fn();
    document.body.innerHTML = `
      <button id="switcher">Qwen3-Plus</button>
      <div id="menu" style="display:none">
        <div role="option">Qwen3-Plus</div>
        <div role="option" id="max">Qwen3-Max</div>
      </div>`;
    // Reveal the menu when the trigger is clicked, mimicking a real dropdown.
    document.getElementById('switcher')!.addEventListener('click', () => {
      (document.getElementById('menu') as HTMLElement).style.display = 'block';
    });
    document.getElementById('max')!.addEventListener('click', optionClick);

    await ActionEngine.exec({
      type: 'selectByText',
      params: { triggerText: 'Qwen3-Plus', optionText: 'Qwen3-Max', optionScope: '#menu', menuDelay: 0 },
    });
    expect(optionClick).toHaveBeenCalled();
  });

  it('is idempotent: skips when currentLabel already shows the target model', async () => {
    makeVisible();
    const triggerClick = vi.fn();
    document.body.innerHTML = `<button id="switcher" class="cur">Qwen3-Max</button>`;
    document.getElementById('switcher')!.addEventListener('click', triggerClick);

    await ActionEngine.exec({
      type: 'selectByText',
      params: {
        triggerText: 'whatever',
        optionText: 'Qwen3-Max',
        currentLabel: '.cur',
        currentText: 'Qwen3-Max',
        menuDelay: 0,
      },
    });
    // Already on the target → must not even open the menu.
    expect(triggerClick).not.toHaveBeenCalled();
  });

  it('fails safe when the option never appears (no throw)', async () => {
    makeVisible();
    document.body.innerHTML = `<button id="switcher">Model</button>`;
    await expect(
      ActionEngine.exec({
        type: 'selectByText',
        params: { triggerText: 'Model', optionText: 'nonexistent', timeout: 50, menuDelay: 0 },
      }),
    ).resolves.toBeUndefined();
  });

  it('does NOT treat "Research" label as already-selected for target "Search"', async () => {
    makeVisible();
    const optionClick = vi.fn();
    // currentLabel reads "Research" — substring of nothing here, but the target "Search"
    // is a substring of "Research". Naive includes() would wrongly skip selection.
    document.body.innerHTML = `
      <button id="switcher" class="cur">Research</button>
      <div id="menu" style="display:none"><div role="option" id="opt">Search</div></div>`;
    document.getElementById('switcher')!.addEventListener('click', () => {
      (document.getElementById('menu') as HTMLElement).style.display = 'block';
    });
    document.getElementById('opt')!.addEventListener('click', optionClick);

    await ActionEngine.exec({
      type: 'selectByText',
      params: { triggerText: 'Research', optionText: 'Search', currentLabel: '.cur', optionScope: '#menu', menuDelay: 0 },
    });
    // Must proceed to select "Search", not bail thinking it's already chosen.
    expect(optionClick).toHaveBeenCalled();
  });

  // DouBao-shaped switcher: trigger + options are plain <div>s, not buttons. The pill
  // shows the current mode (快速); clicking it reveals 思考/专家. The menu items only
  // exist once opened (mirrors the real DOM — a closed menu isn't rendered/visible).
  it('selects a div-based (non-semantic) option — DouBao 快速→专家', async () => {
    makeVisible();
    const expertClick = vi.fn();
    document.body.innerHTML = `
      <div id="pill" class="min-w-0 truncate"><div class="flex items-center">快速</div></div>
      <div id="menu"></div>`;
    document.getElementById('pill')!.addEventListener('click', () => {
      const menu = document.getElementById('menu') as HTMLElement;
      menu.innerHTML = `<div class="opt">思考</div><div class="opt" id="expert">专家</div>`;
      menu.querySelector('#expert')!.addEventListener('click', expertClick);
    });

    await ActionEngine.exec({
      type: 'selectByText',
      params: { triggerText: ['快速', '思考', '专家'], optionText: '专家', includeNonSemantic: true, optionScope: '#menu', menuDelay: 0 },
    });
    expect(expertClick).toHaveBeenCalled();
  });

  it('is idempotent on a switcher: bails when the trigger already shows the target (DouBao 专家)', async () => {
    makeVisible();
    const pillClick = vi.fn();
    document.body.innerHTML = `
      <div id="pill" class="min-w-0 truncate"><div class="flex items-center">专家</div></div>`;
    document.getElementById('pill')!.addEventListener('click', pillClick);

    await ActionEngine.exec({
      type: 'selectByText',
      params: { triggerText: ['快速', '思考', '专家'], optionText: '专家', includeNonSemantic: true, menuDelay: 0 },
    });
    // Trigger already reads 专家 → must not open the menu on refresh.
    expect(pillClick).not.toHaveBeenCalled();
  });
});
