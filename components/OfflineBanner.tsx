import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '../services/i18n';
import { spacing } from '../services/i18n-core';
import { offlineQueue, useOfflineQueue } from '../services/offline';
import { isPutOff, problemMessage } from '../services/offline-queue';
import { announceNewProblems, type AnnounceState } from '../services/problem-announce';

/** How long a new problem waits before it is read out: a screen that tells a refusal itself dismisses it at once, and it is then not read twice. */
const ANNOUNCE_DELAY_MS = 600;

/** The icons say nothing the text does not: the screen reader skips them. */
const ICON_HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** The most refused actions drawn at once: a job that was refused can take three more actions with it, and the screen is small. */
const MAX_PROBLEMS_SHOWN = 2;

/**
 * What the phone is still holding (P3-06), shown at the top of the screens where the technician works: how many actions wait for a signal,
 * a button to try again now, and the actions that the server refused (read once, then dismissed; the newest two are drawn, with the number of
 * the others and one button for all). Nothing is drawn when there is nothing to say.
 * Each time a screen that shows it comes into view it also tries to send what waits, without waiting for the planned time: a technician who
 * walks out of a basement and opens the app should not have to wait for the timer.
 * An action that is only on its way (written a moment ago and being sent) is not "waiting": a phone with a signal shows nothing for it.
 * A new problem is announced to the screen reader (a live region is not read on every platform), by the banner of the screen that is in front
 * only (the tabs stay mounted: each would read it), once the file has been read (what was there before is not new), and if it is still there a
 * moment later.
 */
export function OfflineBanner({ flush = false }: { /** Drawn inside a content area that already has its own side margins. */ flush?: boolean }) {
  const { t, locale } = useI18n();
  const queue = useOfflineQueue();

  // Coming into view is a moment to try (a no-op when nothing waits; a tab that stays mounted tries again each time it is shown).
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void offlineQueue.flush({ force: true });

      return () => {
        focused.current = false;
      };
    }, []),
  );

  const waiting = queue.entries.filter(isPutOff).length;
  const announced = useRef<AnnounceState>({ known: null });
  const latest = useRef(queue.problems);

  latest.current = queue.problems;

  // The list is made again at every publication of the queue (a new array each time, with the same problems in it): the effect below follows
  // what the problems are, not the array. The rules of what is read out, and when, are in `problem-announce.ts`.
  const problemKey = queue.problems.map((problem) => problem.id).join('|');

  useEffect(
    () =>
      announceNewProblems(announced.current, latest.current, {
        ready: queue.ready,
        isFocused: () => focused.current,
        latest: () => latest.current,
        speak: (problem) => AccessibilityInfo.announceForAccessibility(problemMessage(problem, locale)),
        setTimer: (run, ms) => setTimeout(run, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        delayMs: ANNOUNCE_DELAY_MS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the problems by their ids (see above), not by the list of each render
    [problemKey, queue.ready, locale],
  );

  if (waiting === 0 && queue.problems.length === 0 && !queue.loadFailed) return null;

  const shown = queue.problems.slice(-MAX_PROBLEMS_SHOWN);
  const hidden = queue.problems.length - shown.length;

  return (
    <View style={[styles.wrap, flush && styles.wrapFlush]}>
      {queue.loadFailed ? (
        <View style={styles.problem} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color="#fca5a5" style={styles.icon} {...ICON_HIDDEN} />
          <View style={styles.body}>
            <Text style={styles.problemText}>{t('app.offline.notRead')}</Text>
            <TouchableOpacity
              onPress={() => void offlineQueue.flush({ force: true })}
              style={styles.dismiss}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t('common.actions.retry')}
            >
              <Text style={styles.dismissText}>{t('common.actions.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {shown.map((problem) => (
        <View key={problem.id} style={styles.problem} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color="#fca5a5" style={styles.icon} {...ICON_HIDDEN} />
          <View style={styles.body}>
            <Text style={styles.problemText}>{problemMessage(problem, locale)}</Text>
            <TouchableOpacity
              onPress={() => void offlineQueue.dismiss(problem.id)}
              style={styles.dismiss}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
            >
              <Text style={styles.dismissText}>{t('app.offline.dismiss')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {hidden > 0 ? (
        <View style={styles.problem}>
          <View style={styles.body}>
            <Text style={styles.problemText}>{t('app.offline.moreProblems', { count: hidden })}</Text>
            <TouchableOpacity
              onPress={() => void offlineQueue.dismiss()}
              style={styles.dismiss}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t('app.offline.dismissAll')}
            >
              <Text style={styles.dismissText}>{t('app.offline.dismissAll')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {waiting > 0 ? (
        <View style={styles.waiting}>
          <Ionicons name="cloud-offline-outline" size={22} color="#D4AF37" style={styles.icon} {...ICON_HIDDEN} />
          <View style={styles.body}>
            <Text style={[styles.title, { letterSpacing: spacing(locale, 1) }]}>{t('app.offline.title')}</Text>
            <Text style={styles.text} accessibilityLiveRegion="polite">
              {t('app.offline.waiting', { count: waiting })}
            </Text>
            <Text style={styles.hint}>{t('app.offline.waitingHint')}</Text>
            <TouchableOpacity
              onPress={() => void offlineQueue.flush({ force: true })}
              disabled={queue.sending}
              hitSlop={HIT_SLOP}
              style={[styles.button, queue.sending && styles.buttonBusy]}
              accessibilityRole="button"
              accessibilityState={{ disabled: queue.sending, busy: queue.sending }}
            >
              <Text style={styles.buttonText}>{queue.sending ? t('app.offline.sending') : t('app.offline.sendNow')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A small mark on a mission card: some of its actions have not left the phone yet. Nothing is drawn otherwise. */
export function PendingBadge({ missionId }: { missionId: string | number }) {
  const { t } = useI18n();
  const queue = useOfflineQueue();
  const id = String(missionId);

  if (!queue.entries.some((entry) => entry.missionId === id && isPutOff(entry))) return null;

  return (
    <View style={styles.badge}>
      <Ionicons name="cloud-upload-outline" size={12} color="#D4AF37" {...ICON_HIDDEN} />
      <Text style={styles.badgeText}>{t('app.offline.badge')}</Text>
    </View>
  );
}

/** The buttons are small: the finger may land a little outside them. */
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 } as const;

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  wrapFlush: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 16,
  },
  waiting: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4AF37',
    padding: 14,
  },
  problem: {
    flexDirection: 'row',
    backgroundColor: '#3b1218',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    padding: 14,
  },
  icon: {
    marginEnd: 10,
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  text: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  problemText: {
    color: '#fecaca',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonBusy: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dismiss: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  dismissText: {
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  badgeText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '600',
  },
});
