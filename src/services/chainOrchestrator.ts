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
}

export interface ChainState {
  status: ChainStatus;
  steps: ChainStep[];
  currentStep: number;
  originalPrompt: string;
  template: string;
  history: ChainHistoryEntry[];
  lastError: string | null;

  start(originalPrompt: string, steps: ChainStep[]): void;
  next(): Promise<void>;
  abort(): void;
  reset(): void;
}

export function createChainStore(dispatcher: ChainDispatcher): StoreApi<ChainState> {
  return createStore<ChainState>((set, get) => ({
    status: 'idle',
    steps: [],
    currentStep: -1,
    originalPrompt: '',
    template: DEFAULT_CHAIN_TEMPLATE,
    history: [],
    lastError: null,

    start(originalPrompt: string, steps: ChainStep[]) {
      if (steps.length === 0) {
        throw new Error('Cannot start chain with empty steps');
      }
      set({
        status: 'waiting_user',
        steps,
        currentStep: 0,
        originalPrompt,
        history: [],
        lastError: null,
      });
      const state = get();
      const firstStep = state.steps[0];
      dispatcher.sendToPlatform(firstStep.platformId, state.originalPrompt);
    },

    async next() {
      const state = get();
      if (state.status !== 'waiting_user' && state.status !== 'running') {
        return;
      }
      if (state.currentStep < 0 || state.currentStep >= state.steps.length) {
        return;
      }

      const current = state.steps[state.currentStep];
      const harvested = await dispatcher.harvestFromPlatform(current.platformId);
      const trimmed = harvested.trim();
      if (trimmed.length === 0) {
        set({ lastError: 'Harvested content is empty' });
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
      });
    },

    abort() {
      const state = get();
      if (state.status === 'idle') return;
      set({ status: 'aborted' });
    },

    reset() {
      set({
        status: 'idle',
        steps: [],
        currentStep: -1,
        originalPrompt: '',
        template: DEFAULT_CHAIN_TEMPLATE,
        history: [],
        lastError: null,
      });
    },
  }));
}
