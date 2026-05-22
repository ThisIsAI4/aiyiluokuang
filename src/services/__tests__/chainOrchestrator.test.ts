import { describe, it, expect, vi } from 'vitest';
import { createChainStore, type ChainDispatcher } from '../chainOrchestrator';

const makeDispatcher = (): ChainDispatcher => ({
  sendToPlatform: vi.fn(),
  harvestFromPlatform: vi.fn(),
  platformName: vi.fn((id: string) => id.toUpperCase()),
});

describe('chainOrchestrator', () => {
  it('starts and sends only the first step', () => {
    const d = makeDispatcher();
    const store = createChainStore(d);
    const steps = [{ platformId: 'a' }, { platformId: 'b' }];

    store.getState().start('hello', steps);

    expect(store.getState().status).toBe('waiting_user');
    expect(store.getState().currentStep).toBe(0);
    expect(d.sendToPlatform).toHaveBeenCalledTimes(1);
    expect(d.sendToPlatform).toHaveBeenCalledWith('a', 'hello');
  });

  it('next harvests current panel and feeds into next', async () => {
    const d = makeDispatcher();
    vi.mocked(d.harvestFromPlatform).mockResolvedValue('harvested-text');
    const store = createChainStore(d);
    const steps = [{ platformId: 'a' }, { platformId: 'b' }];

    store.getState().start('hello', steps);
    await store.getState().next();

    expect(d.harvestFromPlatform).toHaveBeenCalledWith('a');
    expect(d.sendToPlatform).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(d.sendToPlatform).mock.calls[1];
    expect(secondCall[0]).toBe('b');
    expect(secondCall[1]).toContain('hello');
    expect(secondCall[1]).toContain('harvested-text');
    expect(secondCall[1]).toContain('A');
    expect(store.getState().currentStep).toBe(1);
    expect(store.getState().status).toBe('waiting_user');
  });

  it('next with empty harvest does NOT advance', async () => {
    const d = makeDispatcher();
    vi.mocked(d.harvestFromPlatform).mockResolvedValue('   ');
    const store = createChainStore(d);
    const steps = [{ platformId: 'a' }, { platformId: 'b' }];

    store.getState().start('hello', steps);
    await store.getState().next();

    expect(store.getState().currentStep).toBe(0);
    expect(store.getState().status).toBe('waiting_user');
    expect(store.getState().lastError).toBeTruthy();
    expect(d.sendToPlatform).toHaveBeenCalledTimes(1);
  });

  it('reaches done after final step', async () => {
    const d = makeDispatcher();
    vi.mocked(d.harvestFromPlatform).mockResolvedValue('final-harvest');
    const store = createChainStore(d);
    const steps = [{ platformId: 'a' }];

    store.getState().start('hello', steps);
    await store.getState().next();

    expect(store.getState().status).toBe('done');
    expect(store.getState().currentStep).toBe(0);
    expect(d.sendToPlatform).toHaveBeenCalledTimes(1);
  });

  it('abort transitions to aborted', () => {
    const d = makeDispatcher();
    const store = createChainStore(d);
    const steps = [{ platformId: 'a' }];

    store.getState().start('hello', steps);
    store.getState().abort();

    expect(store.getState().status).toBe('aborted');
  });

  it('reset returns to idle', () => {
    const d = makeDispatcher();
    const store = createChainStore(d);
    const steps = [{ platformId: 'a' }];

    store.getState().start('hello', steps);
    store.getState().abort();
    store.getState().reset();

    expect(store.getState().status).toBe('idle');
    expect(store.getState().steps).toEqual([]);
    expect(store.getState().currentStep).toBe(-1);
    expect(store.getState().originalPrompt).toBe('');
    expect(store.getState().history).toEqual([]);
    expect(store.getState().lastError).toBeNull();
  });

  it('rejects start with empty steps', () => {
    const d = makeDispatcher();
    const store = createChainStore(d);

    expect(() => store.getState().start('hello', [])).toThrow();
    expect(store.getState().status).toBe('idle');
  });
});
