/** Native location calls cannot be cancelled; bound the wait and discard late results. */
export function bounded<T>(operation: Promise<T>, signal: AbortSignal | undefined, disposeLate?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error) => {
      if (settled) return;
      settled = true; cleanup(); reject(error);
    };
    const cancel = () => finish(new Error('Request cancelled.'));
    const timer = setTimeout(() => finish(new Error('Location timed out. Retry from the footpath.')), 25_000);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
    signal?.addEventListener('abort', cancel);
    if (signal?.aborted) cancel();
    operation.then(value => {
      if (settled) { disposeLate?.(value); return; }
      settled = true; cleanup(); resolve(value);
    }, error => { if (!settled) { settled = true; cleanup(); reject(error); } });
  });
}
