import type { LLMToolDefinition } from '@apm/shared';

export interface LoopEmitter {
  onThinkingDelta(text: string): void;
  onTextDelta(text: string): void;
  onToolCall(
    toolName: string,
    input: Record<string, unknown>,
    result: Record<string, unknown>,
    isError: boolean,
  ): void;
  onError(message: string): void;
  onStart(eventName: string, source: string): void;
  onDone(): void;
}

export interface LoopContext {
  label: string;
  eventName: string;
  maxIterations: number;
  tools: LLMToolDefinition[];
  systemPrompt: string;
  emitter: LoopEmitter;
}
