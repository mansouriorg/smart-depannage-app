import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { availabilityLabels, isolateFor, type AvailabilityView } from '@/lib/shared';
import { useI18n } from '../services/i18n';
import { spacing } from '../services/i18n-core';

/**
 * Online or offline, for real (P1-15): the switch shows what the server says, and moves only when the server has
 * answered. While the answer is on its way the switch is held still.
 */
export function AvailabilityCard({
  view,
  failed = false,
  busy,
  onToggle,
  onRefreshPosition,
  refreshing,
  where,
}: {
  /** What the server says; null while it has not been asked yet. */
  view: AvailabilityView | null;
  /** The server could not be asked (no network): the switch says so instead of waiting for ever. */
  failed?: boolean;
  busy: boolean;
  onToggle: () => void;
  onRefreshPosition: () => void;
  refreshing: boolean;
  /** Where the artisan was last put on the map: an address or coordinates. */
  where: string | null;
}) {
  const { t, locale } = useI18n();
  const on = view === 'online' || view === 'busy';
  const color = view === 'online' ? '#10b981' : view === 'busy' ? '#f59e0b' : '#94a3b8';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="navigate-circle" size={24} color="#D4AF37" />
          <Text style={styles.title}>{t('app.availability.title')}</Text>
        </View>

        {view === null ? (
          failed ? null : <ActivityIndicator color="#D4AF37" />
        ) : (
          <View style={[styles.pill, { backgroundColor: on ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)' }]}>
            <Text style={[styles.pillText, { color, letterSpacing: spacing(locale, 0.5) }]}>{`${on ? '●' : '○'} ${availabilityLabels(locale)[view].toUpperCase()}`}</Text>
          </View>
        )}
      </View>

      <Text style={styles.subtitle}>
        {view === null
          ? failed
            ? t('app.availability.unreadable')
            : t('app.availability.loading')
          : view === 'online'
          ? t('app.availability.online')
          : view === 'busy'
            ? t('app.availability.busy')
            : t('app.availability.offline')}
      </Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{view === null ? '—' : on ? t('app.availability.available') : t('app.availability.notAvailable')}</Text>
        {busy ? (
          <ActivityIndicator color="#D4AF37" />
        ) : (
          <Switch
            value={on}
            onValueChange={onToggle}
            disabled={view === null}
            trackColor={{ false: '#334155', true: 'rgba(16, 185, 129, 0.5)' }}
            thumbColor={on ? '#10b981' : '#cbd5e1'}
            accessibilityLabel={t('app.availability.switchLabel')}
          />
        )}
      </View>

      {on && where ? (
        <View style={styles.terminalBox}>
          <Text style={styles.terminalLabel}>{t('app.availability.lastPosition')}</Text>
          {/* coordinates keep their order inside a right-to-left screen; an address keeps the direction of its own letters */}
          <Text style={styles.whereText}>{isolateFor(locale, where)}</Text>
        </View>
      ) : null}

      {on ? (
        <TouchableOpacity style={[styles.button, refreshing && { opacity: 0.7 }]} onPress={onRefreshPosition} disabled={refreshing || busy}>
          {refreshing ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#0f172a" style={{ marginEnd: 8 }} />
              <Text style={styles.buttonText}>{t('app.availability.refresh')}</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 22,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 40,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  terminalBox: {
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    borderStartWidth: 4,
    borderStartColor: '#D4AF37',
  },
  terminalLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },
  whereText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
});
