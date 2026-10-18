import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { DECLINE_REASONS, type MissionRejectionReason } from '@/lib/shared';
import { declineIsReady } from '../services/mission-steps';

/** The longest note the screen takes; the back office reads it in a list. */
const NOTE_MAX = 300;

/**
 * The question asked before a mission is refused or given back (P1-15): why. The answer goes to the dispatcher with
 * the mission, which returns to the queue.
 */
export function DeclineModal({
  visible,
  question,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  question: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: MissionRejectionReason, note: string) => void;
}) {
  const [reason, setReason] = useState<MissionRejectionReason | null>(null);
  const [note, setNote] = useState('');

  // Each time the question is asked, it is asked afresh.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
    }
  }, [visible]);

  const ready = declineIsReady(reason, note);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{question}</Text>

          {DECLINE_REASONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, reason === option.value && styles.optionOn]}
              onPress={() => setReason(option.value)}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === option.value }}
            >
              <View style={[styles.radio, reason === option.value && styles.radioOn]} />
              <Text style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={styles.note}
            value={note}
            onChangeText={setNote}
            placeholder={reason === 'OTHER' ? 'Précisez la raison' : 'Un mot pour l’équipe (facultatif)'}
            placeholderTextColor="#64748b"
            multiline
            maxLength={NOTE_MAX}
            editable={!busy}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirm, !ready && styles.confirmOff]}
              onPress={() => reason && ready && onConfirm(reason, note.trim())}
              disabled={!ready || busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirmer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.7)' },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  optionOn: { borderColor: '#D4AF37' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#64748b' },
  radioOn: { borderColor: '#D4AF37', backgroundColor: '#D4AF37' },
  optionText: { color: '#e2e8f0', fontSize: 15, flex: 1 },
  note: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 12,
    color: '#fff',
    backgroundColor: '#0f172a',
    textAlignVertical: 'top',
  },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 6 },
  cancel: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  cancelText: { color: '#cbd5e1', fontWeight: '700' },
  confirm: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444' },
  confirmOff: { opacity: 0.4 },
  confirmText: { color: '#fff', fontWeight: '800' },
});
