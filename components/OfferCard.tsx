import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  awayText,
  isUrgent,
  msLeft,
  outcomeText,
  serviceName,
  timeLeftAccessibility,
  timeLeftText,
  type MyOffer,
} from '@/lib/shared';
import { useI18n } from '../services/i18n';
import { mirrorStyle } from '../services/i18n-core';

/** The job of an offer that is still open: the board's copy with the distance; the address and the trade are all the card shows of it. */
function jobFields(offer: MyOffer): { serviceType: string; address: string | null; km: number | null } {
  const job = offer.job as ({ serviceType: string; address?: string; distanceKm?: number | null } | null);

  return { serviceType: job?.serviceType ?? '', address: job?.address ?? null, km: job?.distanceKm ?? null };
}

/**
 * An offer the technician can answer (P3-07): the trade, where, how far, and the time left. Pressing the card opens the offer; the green button
 * accepts it at once. The first technician to accept gets the mission, so the accept is not kept for later: it needs the server's answer.
 */
export function OfferCard({
  offer,
  phoneNow,
  offset,
  busy,
  onOpen,
  onAccept,
}: {
  offer: MyOffer;
  phoneNow: number;
  offset: number | null;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
}) {
  const { t, locale } = useI18n();
  const { serviceType, address, km } = jobFields(offer);
  const left = msLeft(offer.expiresAt, phoneNow, offset);
  const urgent = isUrgent(left);
  const away = awayText(locale, km);

  return (
    <TouchableOpacity style={[styles.card, urgent && styles.cardUrgent]} activeOpacity={0.8} onPress={onOpen} disabled={busy} accessibilityRole="button">
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <View style={styles.icon}>
            <Ionicons name="flash" size={16} color="#D4AF37" />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {serviceName(serviceType, locale)}
          </Text>
        </View>
        <View style={[styles.timer, urgent && styles.timerUrgent]} accessible accessibilityLabel={timeLeftAccessibility(locale, left)}>
          <Ionicons name="time-outline" size={14} color={urgent ? '#ef4444' : '#D4AF37'} />
          <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>{timeLeftText(locale, left)}</Text>
        </View>
      </View>

      {address ? (
        <View style={styles.detail}>
          <Ionicons name="location-outline" size={14} color="#94a3b8" />
          <Text style={styles.detailText} numberOfLines={1}>
            {address}
          </Text>
        </View>
      ) : null}

      {away ? (
        <View style={styles.detail}>
          <Ionicons name="navigate-outline" size={14} color="#94a3b8" />
          <Text style={styles.detailText}>{away}</Text>
        </View>
      ) : null}

      <Text style={styles.hint}>{t('app.offers.firstWins')}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.accept, busy && styles.acceptBusy]} onPress={onAccept} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.acceptText}>{t('app.offers.accept')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.view} onPress={onOpen} disabled={busy} accessibilityRole="button">
          <Text style={styles.viewText}>{t('app.offers.view')}</Text>
          <Ionicons name="arrow-forward" size={14} color="#D4AF37" style={mirrorStyle(locale)} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/** An offer that was lost (ran out, or taken away): what happened, in one line. */
export function LostOfferRow({ offer }: { offer: MyOffer }) {
  const { locale } = useI18n();
  const { serviceType } = jobFields(offer);
  const why = outcomeText(locale, offer.state, offer.because);

  return (
    <View style={styles.lost}>
      <Ionicons name="alert-circle-outline" size={18} color="#94a3b8" />
      <View style={styles.lostBody}>
        <Text style={styles.lostTitle}>{serviceName(serviceType, locale)}</Text>
        {why ? <Text style={styles.lostText}>{why}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    gap: 10,
  },
  cardUrgent: { borderColor: 'rgba(239, 68, 68, 0.7)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  timerUrgent: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  timerText: { color: '#D4AF37', fontSize: 13, fontWeight: '700' },
  timerTextUrgent: { color: '#ef4444' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { color: '#cbd5e1', fontSize: 14, flex: 1 },
  hint: { color: '#94a3b8', fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  accept: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBusy: { opacity: 0.6 },
  acceptText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
  view: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 12 },
  viewText: { color: '#D4AF37', fontSize: 13, fontWeight: '600' },
  lost: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  lostBody: { flex: 1, gap: 2 },
  lostTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  lostText: { color: '#94a3b8', fontSize: 13 },
});
