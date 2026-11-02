export async function register() {
  // Tracing is live only. It needs TRACELOOP_API_KEY and is off in demo mode.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.TRACELOOP_API_KEY) {
    await import('./instrumentation.node');
  }
}
