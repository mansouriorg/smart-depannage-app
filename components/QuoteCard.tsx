import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { quoteState, quoteTotalText, type ArtisanIntervention } from '@/lib/shared';

const STAGE_LOOK = {
  none: { color: '#94a3b8', icon: 'document-text-outline' },
  waiting: { color: '#f59e0b', icon: 'time-outline' },
  expired: { color: '#ef4444', icon: 'alert-circle-outline' },
  changes: { color: '#f97316', icon: 'create-outline' },
  accepted: { color: '#10b981', icon: 'checkmark-circle' },
} as const;

/**
 * The quote of a mission (P2-05): where it stands, its total, and what the artisan can do about it: make one, or change
 * the one that is out. What the artisan may do comes from the shared package (`quoteState`), which also decides it in
 * the quote screen, so the button and the screen it opens cannot disagree.
 */
export function QuoteCard({
  job,
  onMake,
  onChange,
}: {
  job: Pick<ArtisanIntervention, 'status' | 'quotes'>;
  onMake: () => void;
  onChange: (quoteId: number) => void;
}) {
  const state = quoteState(job);
  const look = STAGE_LOOK[state.stage];
  const quote = state.quote;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="receipt" size={20} color="#D4AF37" />
        <Text style={styles.title}>DEVIS</Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons name={look.icon} size={20} color={look.color} />
        <Text style={[styles.words, { color: look.color }]}>{state.words}</Text>
      </View>

      {quote ? (
        <View style={styles.quoteBox}>
          <Text style={styles.quoteTitle} numberOfLines={2}>
            {quote.title}
          </Text>
          <Text style={styles.quoteTotal}>{quoteTotalText(quote)}</Text>
          {state.stage === 'changes' && quote.clientNote ? <Text style={styles.note}>« {quote.clientNote} »</Text> : null}
        </View>
      ) : null}

      {state.canCreate ? (
        <TouchableOpacity style={styles.button} onPress={onMake} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={18} color="#D4AF37" />
          <Text style={styles.buttonText}>{quote ? 'Établir un nouveau devis' : 'Établir un devis'}</Text>
        </TouchableOpacity>
      ) : null}

      {state.canEdit && quote ? (
        <TouchableOpacity style={styles.button} onPress={() => onChange(quote.id)} accessibilityRole="button">
          <Ionicons name="create-outline" size={18} color="#D4AF37" />
          <Text style={styles.buttonText}>{state.resend ? 'Modifier et renvoyer le devis' : state.stage === 'expired' ? 'Modifier et prolonger le devis' : 'Modifier le devis'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 12, color: '#D4AF37', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  words: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  quoteBox: { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: '#334155' },
  quoteTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  quoteTotal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  note: { color: '#cbd5e1', fontSize: 14, fontStyle: 'italic', marginTop: 4, lineHeight: 20 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  buttonText: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },
});
