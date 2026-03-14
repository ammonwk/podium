import type {
  LLMClient,
  LLMStreamEvent,
  LLMMessage,
  LLMToolDefinition,
} from '@apm/shared';

const BREAKER_COOLDOWN_MS = 60_000;

export class CircuitBreakerClient implements LLMClient {
  private primary: LLMClient;
  private fallback: LLMClient;
  private trippedUntil: number | null = null;

  get provider(): string {
    return this.primary.provider;
  }
  get model(): string {
    return this.primary.model;
  }

  constructor(primary: LLMClient, fallback: LLMClient) {
    this.primary = primary;
    this.fallback = fallback;
  }

  private isTripped(): boolean {
    if (!this.trippedUntil) return false;
    if (Date.now() >= this.trippedUntil) {
      this.trippedUntil = null;
      console.log(
        `[CIRCUIT BREAKER] Breaker reset for ${this.primary.provider}`,
      );
      return false;
    }
    return true;
  }

  private trip(): void {
    this.trippedUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.log(
      `[CIRCUIT BREAKER] 429 from ${this.primary.provider}, tripped for 60s → OpenRouter (${this.fallback.model})`,
    );
  }

  private isRateLimitError(err: unknown): boolean {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      return (err as { status: number }).status === 429;
    }
    return false;
  }

  async *stream(
    system: string,
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
  ): AsyncIterable<LLMStreamEvent> {
    if (this.isTripped()) {
      console.log(
        `[CIRCUIT BREAKER] Breaker still open for ${this.primary.provider}, routing through OpenRouter`,
      );
      yield* this.fallback.stream(system, messages, tools);
      return;
    }

    try {
      yield* this.primary.stream(system, messages, tools);
    } catch (err) {
      if (this.isRateLimitError(err)) {
        this.trip();
        yield* this.fallback.stream(system, messages, tools);
      } else {
        throw err;
      }
    }
  }
}
