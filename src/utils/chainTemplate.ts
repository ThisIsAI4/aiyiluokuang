export type ChainVars = {
  prompt: string;
  harvested: string;
  prevPlatform: string;
};

export const DEFAULT_CHAIN_TEMPLATE =
  '{prompt}\n\n上一步（{prevPlatform}）的关键回答：\n{harvested}';

export function assembleChainPrompt(template: string, vars: ChainVars): string {
  return template
    .replaceAll('{prompt}', vars.prompt)
    .replaceAll('{harvested}', vars.harvested)
    .replaceAll('{prevPlatform}', vars.prevPlatform);
}
