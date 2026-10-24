import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatDinars, type CashPosition } from '@/lib/shared';

/**
 * What the customer has paid on a mission and what is left, with the button to say that cash was taken (P2-05). The figures
 * and the permission come from the server (`GET /cash-ledger/interventions/:id/position`), the same checks as the
 * collection itself, so the button is shown only when the server would accept it.
 *
 * Nothing is shown while the mission has nothing to pay (no accepted quote and no invoice yet).
 */
export function CashCard({ position, stale = false, onCollect }: { position: CashPosition | null; /** The figures are not known to be current: the button waits for the next read. */ stale?: boolean; onCollect: () => void }) {
  if (!position || position.document === null || position.total === null || position.remaining === null) return null;

  const settled = position.remaining <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="cash" size={20} color="#D4AF37" />
        <Text style={styles.title}>ENCAISSEMENT</Text>
      </View>

      <View style={styles.figures}>
        <Row label={position.document === 'INVOICE' ? 'Facture' : 'Devis accepté'} value={formatDinars(position.total)} />
        <Row label="Déjà payé" value={formatDinars(position.received)} />
        <Row label="Reste à payer" value={formatDinars(Math.max(position.remaining, 0))} strong />
      </View>

      {position.collected > 0 ? <Text style={styles.mine}>Dont {formatDinars(position.collected)} encaissés en espèces par vous.</Text> : null}

      {settled ? (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={[styles.words, { color: '#10b981' }]}>Cette mission est payée en totalité.</Text>
        </View>
      ) : null}

      {!settled && !position.canCollect && position.reason ? <Text style={styles.reason}>{position.reason}</Text> : null}

      {stale ? <Text style={styles.reason}>Mise à jour des montants… Tirez l’écran vers le bas si cela dure.</Text> : null}

      {position.canCollect && !stale ? (
        <TouchableOpacity style={styles.button} onPress={onCollect} accessibilityRole="button">
          <Ionicons name="cash-outline" size={18} color="#0f172a" />
          <Text style={styles.buttonText}>J’ai encaissé en espèces</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong]}>{value}</Text>
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
  figures: { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: '#94a3b8', fontSize: 14, flexShrink: 1 },
  value: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  strong: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  mine: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  words: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  reason: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#D4AF37',
  },
  buttonText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
});
