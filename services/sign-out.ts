/**
 * Runs the clean-up steps of a sign-out together (stop the pushes to this phone, go offline), for at most `ms`
 * milliseconds in all. Each step is best effort: one that fails, or that does not finish in time, never stops the
 * artisan from signing out on the phone. They start at the same moment, while the session still works, so that a
 * slow first step cannot use up the time of the second; when the time is up the steps that are still running are
 * told to stop (the signal), so that no request is left to fail later against a session that is gone and send the
 * phone back to the login screen a second time. Gives back how many steps were done in time.
 */
export async function runBestEffort(steps: Array<(signal: AbortSignal) => Promise<unknown>>, ms = 4000): Promise<number> {
  const controller = new AbortController();
  let done = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const work = Promise.all(
    steps.map(async (step) => {
      try {
        await step(controller.signal);
        done++;
      } catch {
        // ignored on purpose
      }
    }),
  );

  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, ms);
  });

  await Promise.race([work, limit]);

  if (timer !== undefined) clearTimeout(timer);

  return done;
}
