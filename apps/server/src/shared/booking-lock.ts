/**
 * Per-property promise-chain mutex.
 * Serializes booking mutations for a given property while allowing
 * different properties to proceed concurrently.
 */
const locks = new Map<string, Promise<unknown>>();

export async function withPropertyLock<T>(propertyId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(propertyId) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  locks.set(propertyId, next);

  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
    // Clean up if nothing else is queued
    if (locks.get(propertyId) === next) {
      locks.delete(propertyId);
    }
  }
}
