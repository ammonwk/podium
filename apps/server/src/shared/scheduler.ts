const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function registerTask(
  taskId: string,
  delayMs: number,
  callback: () => void,
): void {
  const handle = setTimeout(() => {
    pendingTimers.delete(taskId);
    callback();
  }, delayMs);

  pendingTimers.set(taskId, handle);
  console.log(`[SCHEDULER] Task ${taskId} registered, fires in ${delayMs}ms`);
}

export function cancelAll(): void {
  for (const [taskId, handle] of pendingTimers) {
    clearTimeout(handle);
    console.log(`[SCHEDULER] Cancelled task ${taskId}`);
  }
  pendingTimers.clear();
}

export function getPendingCount(): number {
  return pendingTimers.size;
}

export function cancelTask(taskId: string): boolean {
  const handle = pendingTimers.get(taskId);
  if (handle) {
    clearTimeout(handle);
    pendingTimers.delete(taskId);
    return true;
  }
  return false;
}
