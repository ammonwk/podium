import type {
  LLMClient,
  LLMStreamEvent,
  LLMMessage,
  LLMToolDefinition,
} from '@apm/shared';

const BREAKER_COOLDOWN_MS = 60_000;
const MAX_RETRIES = 3;

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

  private trip(reason: string): void {
    this.trippedUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.log(
      `[CIRCUIT BREAKER] ${reason} from ${this.primary.provider}, tripped for 60s → OpenRouter (${this.fallback.model})`,
    );
  }

  private isRateLimitError(err: unknown): boolean {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      return (err as { status: number }).status === 429;
    }
    return false;
  }

  private isServerError(err: unknown): boolean {
    if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      if (e.type === 'server_error') return true;
      if ('status' in e) {
        const status = e.status as number;
        return status >= 500 && status < 600;
      }
    }
    return false;
  }

  private async *streamFallbackWithRetries(
    system: string,
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
  ): AsyncIterable<LLMStreamEvent> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        yield* this.fallback.stream(system, messages, tools);
        return;
      } catch (err) {
        console.log(
          `[CIRCUIT BREAKER] Fallback error from ${this.fallback.provider} (attempt ${attempt}/${MAX_RETRIES}):`,
          err instanceof Error ? err.message : err,
        );
        if (attempt >= MAX_RETRIES) throw err;
      }
    }
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
      yield* this.streamFallbackWithRetries(system, messages, tools);
      return;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        yield* this.primary.stream(system, messages, tools);
        return;
      } catch (err) {
        if (this.isRateLimitError(err)) {
          this.trip('429');
          yield* this.streamFallbackWithRetries(system, messages, tools);
          return;
        }
        if (this.isServerError(err)) {
          console.log(
            `[CIRCUIT BREAKER] Server error from ${this.primary.provider} (attempt ${attempt}/${MAX_RETRIES})`,
          );
          if (attempt < MAX_RETRIES) continue;
          // All retries exhausted — trip breaker and fall back
          this.trip(`Server error (${MAX_RETRIES} consecutive failures)`);
          yield* this.streamFallbackWithRetries(system, messages, tools);
          return;
        }
        throw err;
      }
    }
  }
}
