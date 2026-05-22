import { createChainStore, type ChainDispatcher } from './chainOrchestrator';

type PanelHandle = {
  sendText(text: string): Promise<void>;
  harvestSelection(): Promise<string>;
};

type PanelRegistry = {
  resolve(platformId: string): PanelHandle | null;
  platformName(platformId: string): string;
};

let registry: PanelRegistry | null = null;

export function bindPanelRegistry(r: PanelRegistry): void {
  registry = r;
}

const dispatcher: ChainDispatcher = {
  async sendToPlatform(platformId, text) {
    const p = registry?.resolve(platformId);
    if (!p) throw new Error(`panel not found: ${platformId}`);
    await p.sendText(text);
  },
  async harvestFromPlatform(platformId) {
    const p = registry?.resolve(platformId);
    if (!p) return '';
    return p.harvestSelection();
  },
  platformName(platformId) {
    return registry?.platformName(platformId) ?? platformId;
  },
};

export const chainStore = createChainStore(dispatcher);
