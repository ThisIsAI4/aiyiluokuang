import { createStore, type StoreApi } from 'zustand/vanilla';
import { assembleChainPrompt, DEFAULT_CHAIN_TEMPLATE } from '../utils/chainTemplate';

export type ChainStatus = 'idle' | 'running' | 'waiting_user' | 'done' | 'aborted';

export interface ChainStep {
  platformId: string;
}

export interface ChainHistoryEntry {
  platformId: string;
  prompt: string;
  harvested: string;
}

export interface ChainDispatcher {
  sendToPlatform(platformId: string, prompt: string): void | Promise<void>;
  harvestFromPlatform(platformId: string): string | Promise<string>;
  platformName(platformId: string): string;
  isAutoAdvance(): boolean;
}

export interface ChainState {
  status: ChainStatus;
  steps: ChainStep[];
  currentStep: number;
  originalPrompt: string;
  template: string;
  history: ChainHistoryEntry[];
  lastError: string | null;
  _busy: boolean;

  start(originalPrompt: string, steps: ChainStep[]): Promise<void>;
  next(): Promise<void>;
  abort(): void;
  reset(): void;
}

export function createChainStore(dispatcher: ChainDispatcher): StoreApi<ChainState> {
  return createStore<ChainState>((set, get) => {
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    // Auto-advance polling state. `cancelled` is set by start/next/abort/reset so that
    // at most one poller is active per step and a stale poller never advances a later step.
    let autoAdvanceCancelled = true;

    async function pollForCompletion(platformId: string): Promise<string> {
      const stepSnapshot = get().currentStep;
      const interval = 1500;
      const stableNeed = 2;       // two consecutive identical non-empty harvests
      const maxWait = 180_000;    // 3 min cap; on timeout we leave status waiting_user
      let last = '';
      let stable = 0;
      const startTs = Date.now();
      while (!autoAdvanceCancelled && Date.now() - startTs < maxWait) {
        await wait(interval);
        if (autoAdvanceCancelled) break;
        const s = get();
        if (s.currentStep !== stepSnapshot || (s.status !== 'waiting_user' && s.status !== 'running')) break;
        let cur = '';
        try { cur = ((await dispatcher.harvestFromPlatform(platformId)) || '').trim(); } catch { cur = ''; }
        if (cur && cur === last) {
          stable++;
          if (stable >= stableNeed) return cur;
        } else {
          stable = 0;
          last = cur;
        }
      }
      return '';
    }

    async function maybeAutoAdvance() {
      const s = get();
      if (!dispatcher.isAutoAdvance()) return;
      if (s.status !== 'waiting_user' || s._busy) return;
      const platformId = s.steps[s.currentStep]?.platformId;
      if (!platformId) return;
      autoAdvanceCancelled = false;
      await pollForCompletion(platformId);
      if (autoAdvanceCancelled) return;
      const after = get();
      // Only advance if we are still waiting on the same step (user did not click Next / abort).
      if (after.status === 'waiting_user' && !after._busy && after.currentStep === s.currentStep) {
        await get().next();
      }
    }

    return {
      status: 'idle',
      steps: [],
      currentStep: -1,
      originalPrompt: '',
      template: DEFAULT_CHAIN_TEMPLATE,
      history: [],
      lastError: null,
      _busy: false,

      async start(originalPrompt: string, steps: ChainStep[]) {
        if (steps.length === 0) {
          throw new Error('Cannot start chain with empty steps');
        }
        autoAdvanceCancelled = true;
        set({
          status: 'waiting_user',
          steps,
          currentStep: 0,
          originalPrompt,
          history: [],
          lastError: null,
          _busy: false,
        });
        const state = get();
        const firstStep = state.steps[0];
        try {
          await dispatcher.sendToPlatform(firstStep.platformId, state.originalPrompt);
          void maybeAutoAdvance();
        } catch (err) {
          set({ lastError: err instanceof Error ? err.message : String(err) });
        }
      },

      async next() {
        autoAdvanceCancelled = true;
        const state = get();
        if (state._busy) return;
        if (state.status !== 'waiting_user' && state.status !== 'running') {
          return;
        }
        if (state.currentStep < 0 || state.currentStep >= state.steps.length) {
          return;
        }

        set({ _busy: true, status: 'running', lastError: null });

        try {
          const current = state.steps[state.currentStep];
          const harvested = await dispatcher.harvestFromPlatform(current.platformId);
          const trimmed = harvested.trim();
          if (trimmed.length === 0) {
            set({ lastError: 'Harvested content is empty', status: 'waiting_user', _busy: false });
            return;
          }

          const newHistory: ChainHistoryEntry = {
            platformId: current.platformId,
            prompt:
              state.currentStep === 0
                ? state.originalPrompt
                : assembleChainPrompt(state.template, {
                  prompt: state.originalPrompt,
                  harvested: state.history[state.history.length - 1]?.harvested ?? '',
                  prevPlatform: dispatcher.platformName(state.history[state.history.length - 1]?.platformId ?? ''),
                }),
            harvested: trimmed,
          };

          const updatedHistory = [...state.history, newHistory];

          const nextStepIndex = state.currentStep + 1;
          if (nextStepIndex >= state.steps.length) {
            set({
              status: 'done',
              history: updatedHistory,
              lastError: null,
              _busy: false,
            });
            return;
          }

          const nextStep = state.steps[nextStepIndex];
          const assembled = assembleChainPrompt(state.template, {
            prompt: state.originalPrompt,
            harvested: trimmed,
            prevPlatform: dispatcher.platformName(current.platformId),
          });

          await dispatcher.sendToPlatform(nextStep.platformId, assembled);

          set({
            status: 'waiting_user',
            currentStep: nextStepIndex,
            history: updatedHistory,
            lastError: null,
            _busy: false,
          });
          void maybeAutoAdvance();
        } catch (err) {
          set({
            lastError: err instanceof Error ? err.message : String(err),
            status: 'waiting_user',
            _busy: false,
          });
        }
      },

      abort() {
        autoAdvanceCancelled = true;
        const state = get();
        if (state.status === 'idle') return;
        set({ status: 'aborted' });
      },

      reset() {
        autoAdvanceCancelled = true;
        set({
          status: 'idle',
          steps: [],
          currentStep: -1,
          originalPrompt: '',
          template: DEFAULT_CHAIN_TEMPLATE,
          history: [],
          lastError: null,
          _busy: false,
        });
      },
    };
  });
}
