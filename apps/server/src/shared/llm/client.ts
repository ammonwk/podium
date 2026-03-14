import type { LLMClient, ProviderConfig } from '@apm/shared';
import { DEFAULT_PROVIDER } from '@apm/shared';
import { AnthropicClient } from './anthropic.js';
import { CerebrasClient } from './cerebras.js';
import { OpenRouterClient } from './openrouter.js';
import { CircuitBreakerClient } from './circuit-breaker.js';

// OpenRouter fallback model mapping per provider
const OPENROUTER_FALLBACKS: Record<
  string,
  { model: string; providerOrder?: string[] }
> = {
  anthropic: { model: 'anthropic/claude-sonnet-4' },
  cerebras: { model: 'cerebras/gpt-oss-120b', providerOrder: ['cerebras'] },
};

let activeClient: LLMClient | null = null;
let activeConfig: ProviderConfig = { ...DEFAULT_PROVIDER };

function createClient(config: ProviderConfig): LLMClient {
  let primary: LLMClient;
  switch (config.provider) {
    case 'anthropic':
      primary = new AnthropicClient(config.model);
      break;
    case 'cerebras':
      primary = new CerebrasClient(config.model);
      break;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  const fallbackConfig = OPENROUTER_FALLBACKS[config.provider];
  if (fallbackConfig && process.env.OPENROUTER_API_KEY) {
    const fallback = new OpenRouterClient(
      fallbackConfig.model,
      fallbackConfig.providerOrder,
    );
    return new CircuitBreakerClient(primary, fallback);
  }

  return primary;
}

export function getActiveClient(): LLMClient {
  if (!activeClient) {
    activeClient = createClient(activeConfig);
  }
  return activeClient;
}

export function setProvider(config: ProviderConfig): void {
  activeClient = createClient(config);
  activeConfig = { ...config };
  console.log(
    `[LLM] Provider switched to ${config.provider} (${config.model})`,
  );
}

export function getProviderConfig(): ProviderConfig {
  return { ...activeConfig };
}
