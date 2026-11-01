import { pushHrefOf } from '../lib/shared';

/**
 * The screen a push opens: the mission it is about, the offer screen for a job offered to the technician (P3-07: the job is not theirs yet, so the
 * mission screen would send them away), or nothing when it is about no job.
 */
export function missionHrefFromPush(data: unknown): string | null {
  return pushHrefOf(data);
}

/**
 * Where a tap on a push goes while the app may not be ready for it. At a cold start the app is still on its
 * welcome screen (which then moves on by itself), and a person who is signed out has the login screen: opening
 * the mission at once would be undone by the screen that follows. So a tap waits until the signed-in screens are
 * on show, and is opened then; once they are, a tap opens at once.
 *
 * The signed-in screens can be on show more than once at a time (a second copy is stacked on the first when the
 * artisan is sent "home" with a replace, and the first one goes on living under it), so each copy that shows
 * itself gets its own way out, and taps wait again only when the last copy is gone.
 */
export function createPushGate() {
  let waiting: string | null = null;
  const shown: Array<(href: string) => void> = [];

  return {
    /** A tap on a push that opens this address (null: it opens nothing). */
    tapped(href: string | null) {
      if (!href) return;

      const open = shown[shown.length - 1];

      if (open) open(href);
      else waiting = href;
    },
    /**
     * The signed-in screens are on show: opens the tap that waited, and every later tap at once. Gives back what
     * to call when these screens are gone (signed out, or closed).
     */
    ready(go: (href: string) => void): () => void {
      shown.push(go);

      if (waiting) {
        const href = waiting;

        waiting = null;
        go(href);
      }

      return () => {
        const index = shown.lastIndexOf(go);

        if (index >= 0) shown.splice(index, 1);
      };
    },
  };
}

export const pushGate = createPushGate();
