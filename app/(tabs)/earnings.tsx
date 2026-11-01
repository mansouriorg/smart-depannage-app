import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { call } from '../../services/call';
import { shortDateTime } from '../../services/display';
import { useI18n } from '../../services/i18n';
import { joinList, spacing } from '../../services/i18n-core';
// 🧩 The ledger: the balance owed to the platform and the lines it is made of (P2-05; the server side is P2-02)
import { apiErrorMessage, apiErrorStatus, appendEntries, entryWords, formatMillimes, ledgerSummary, routes, toMillimes, type LedgerEntry, type LedgerTotals } from '@/lib/shared';

/** How many lines a page holds. */
const PAGE = 30;

const TONES = {
  owed: { color: '#f59e0b', icon: 'alert-circle' },
  clear: { color: '#10b981', icon: 'checkmark-circle' },
  credit: { color: '#38bdf8', icon: 'arrow-down-circle' },
} as const;

const DIRECTION = {
  up: '#f59e0b',
  down: '#10b981',
  none: '#94a3b8',
} as const;

export default function EarningsScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();

  const [totals, setTotals] = useState<LedgerTotals | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // An answer that comes back after a newer request was made is dropped: the screen shows the latest.
  const latest = useRef(0);
  const reading = useRef(false);
  // A first page is on its way: a "see more" that began before it would join pages that no longer belong together.
  const reloading = useRef(false);

  /** Reads the first page again: on opening, when the tab comes back into view, on a pull to refresh. */
  const reload = useCallback(async () => {
    const mine = (latest.current += 1);

    reloading.current = true;

    try {
      const page = await call(routes.cash.mine({ limit: PAGE }));

      if (latest.current !== mine) return;

      setTotals(page.totals);
      setEntries(page.entries);
      setNextBefore(page.nextBefore);
      setFailure(null);
    } catch (error) {
      if (latest.current !== mine) return;

      console.error('Error fetching the ledger:', apiErrorStatus(error) ?? (error as Error)?.message);
      setFailure(apiErrorMessage(error, t('app.earnings.loadFailed')));
    } finally {
      if (latest.current === mine) {
        reloading.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t]);

  // A tap on a line opens its mission once: the guard is lifted when this tab has the focus again.
  const opening = useRef(false);

  useFocusEffect(
    useCallback(() => {
      opening.current = false;
      void reload();
    }, [reload]),
  );

  const openMission = (missionId: number) => {
    if (opening.current) return;

    opening.current = true;
    router.push(`/mission/${missionId}` as Href);
    // If the screen never took the focus (the push was refused), the lines work again after a moment.
    setTimeout(() => {
      opening.current = false;
    }, 1500);
  };

  const loadMore = async () => {
    if (reading.current || reloading.current || nextBefore === null) return;

    const mine = latest.current;

    reading.current = true;
    setLoadingMore(true);

    try {
      const page = await call(routes.cash.mine({ limit: PAGE, before: nextBefore }));

      // A reload has begun since: its answer is the one to keep.
      if (latest.current !== mine) return;

      setTotals(page.totals);
      setEntries((current) => appendEntries(current, page.entries));
      setNextBefore(page.nextBefore);
    } catch (error) {
      if (latest.current !== mine) return;

      console.error('Error fetching more of the ledger:', apiErrorStatus(error) ?? (error as Error)?.message);
      setFailure(apiErrorMessage(error, t('app.earnings.loadMoreFailed')));
    } finally {
      reading.current = false;
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  const summary = totals ? ledgerSummary(totals, locale) : null;
  const tone = summary ? TONES[summary.tone] : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('app.earnings.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void reload();
            }}
            tintColor="#D4AF37"
            colors={['#D4AF37']}
          />
        }
      >
        {failure ? (
          <View style={styles.banner}>
            <Ionicons name="cloud-offline-outline" size={20} color="#f87171" />
            <Text style={styles.bannerText}>{failure}</Text>
            <TouchableOpacity
              onPress={() => {
                setRefreshing(true);
                void reload();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.bannerAction}>{t('common.actions.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {summary && tone && totals ? (
          <>
            <View style={[styles.balanceCard, { borderColor: tone.color }]}>
              <View style={styles.balanceHead}>
                <Ionicons name={tone.icon} size={22} color={tone.color} />
                <Text style={[styles.balanceHeadline, { color: tone.color, letterSpacing: spacing(locale, 0.5) }]}>{summary.headline}</Text>
              </View>
              <Text style={styles.balanceAmount} accessibilityLabel={t('app.earnings.balanceLabel', { headline: summary.headline, amount: summary.amountText })}>
                {summary.amountText}
              </Text>
              <Text style={styles.keeps}>{summary.keepsText}</Text>
            </View>

            <View style={styles.stats}>
              <Stat label={t('app.earnings.cashCollected')} value={formatMillimes(toMillimes(totals.cashCollected), undefined, locale)} />
              <Stat label={t('app.earnings.commissionDue')} value={formatMillimes(toMillimes(totals.commissionDue), undefined, locale)} />
              <Stat label={t('app.earnings.commissionRemitted')} value={formatMillimes(toMillimes(totals.commissionRemitted), undefined, locale)} />
            </View>

            <View style={styles.info}>
              <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
              <Text style={styles.infoText}>{t('app.earnings.info')}</Text>
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.earnings.history')}</Text>

        {entries.length === 0 ? (
          failure && totals === null ? null : (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={40} color="#475569" />
              <Text style={styles.emptyText}>{t('app.earnings.empty')}</Text>
            </View>
          )
        ) : (
          entries.map((entry) => {
            const words = entryWords(entry, locale);

            return (
              <TouchableOpacity
                key={entry.id}
                style={styles.entry}
                disabled={entry.interventionId === null}
                onPress={() => entry.interventionId !== null && openMission(entry.interventionId)}
                accessibilityRole={entry.interventionId === null ? undefined : 'button'}
                accessibilityLabel={joinList([words.title, shortDateTime(entry.createdAt, locale), words.effect, words.cash, words.detail], locale)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.entryTitle}>{words.title}</Text>
                  <Text style={styles.entryDate}>{shortDateTime(entry.createdAt, locale)}</Text>
                  {words.detail ? <Text style={styles.entryDetail}>{words.detail}</Text> : null}
                </View>
                <View style={styles.entryFigures}>
                  <Text style={[styles.entryEffect, { color: DIRECTION[words.direction] }]}>{words.effect}</Text>
                  {words.cash ? <Text style={styles.entryCash}>{words.cash}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {nextBefore !== null ? (
          <TouchableOpacity style={[styles.more, loadingMore && styles.moreOff]} onPress={loadMore} disabled={loadingMore} accessibilityRole="button">
            {loadingMore ? <ActivityIndicator color="#D4AF37" /> : <Text style={styles.moreText}>{t('app.earnings.more')}</Text>}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },

  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#1e293b' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },

  content: { padding: 20, paddingBottom: 40, gap: 16 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', borderWidth: 1, borderRadius: 14, padding: 12 },
  bannerText: { flex: 1, color: '#fecaca', fontSize: 13, lineHeight: 18 },
  bannerAction: { color: '#D4AF37', fontWeight: '700' },

  balanceCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, borderWidth: 1, gap: 8 },
  balanceHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceHeadline: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', flex: 1 },
  // Amounts are read left to right, in French and in Arabic: a sign and a unit keep their place.
  balanceAmount: { fontSize: 34, fontWeight: 'bold', color: '#fff', writingDirection: 'ltr' },
  keeps: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: 100, minWidth: 100, backgroundColor: '#1e293b', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#334155', gap: 4 },
  statValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', writingDirection: 'ltr' },
  statLabel: { color: '#94a3b8', fontSize: 11, lineHeight: 14 },

  info: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoText: { flex: 1, color: '#94a3b8', fontSize: 13, lineHeight: 19 },

  sectionTitle: { fontSize: 12, color: '#D4AF37', fontWeight: '800', marginTop: 8 },

  empty: { alignItems: 'center', gap: 12, padding: 24 },
  emptyText: { color: '#94a3b8', fontSize: 14, lineHeight: 21, textAlign: 'center' },

  entry: { flexDirection: 'row', gap: 12, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155' },
  entryTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  entryDate: { color: '#94a3b8', fontSize: 12 },
  entryDetail: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },
  entryFigures: { alignItems: 'flex-end', gap: 2 },
  entryEffect: { fontSize: 15, fontWeight: 'bold', writingDirection: 'ltr' },
  entryCash: { color: '#94a3b8', fontSize: 12 },

  more: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D4AF37' },
  moreOff: { opacity: 0.5 },
  moreText: { color: '#D4AF37', fontWeight: '700', fontSize: 15 },
});
