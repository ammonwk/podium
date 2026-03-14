import type { LLMClient, ProviderConfig } from '@apm/shared';
import { DEFAULT_PROVIDER } from '@apm/shared';
import { AnthropicClient } from './anthropic.js';
import { CerebrasClient } from './cerebras.js';

let activeClient: LLMClient = createClient(DEFAULT_PROVIDER);
let activeConfig: ProviderConfig = { ...DEFAULT_PROVIDER };

function createClient(config: ProviderConfig): LLMClient {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicClient(config.model);
    case 'cerebras':
      return new CerebrasClient(config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getActiveClient(): LLMClient {
  return activeClient;
}

export function setProvider(config: ProviderConfig): void {
  activeClient = createClient(config);
  activeConfig = { ...config };
  console.log(`[LLM] Provider switched to ${config.provider} (${config.model})`);
}

export function getProviderConfig(): ProviderConfig {
  return { ...activeConfig };
}
