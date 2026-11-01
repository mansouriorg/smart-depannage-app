import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import api, { apiErrorMessage, endSession } from '../services/api';
import { useI18n } from '../services/i18n';
import { changePasswordIssue, passwordProblems } from '../services/passwordRules';

/**
 * Change the password (P1-11). An artisan invited by the back office chose a first password
 * from the link they received; this is how they change it later. The server ends every session
 * of the account when the password changes, so the artisan signs in again afterwards.
 */
export default function ChangePasswordScreen() {
  const { t, locale } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = next ? passwordProblems(next, locale) : [];

  const handleSubmit = async () => {
    if (loading) return;

    const issue = changePasswordIssue(current, next, confirm, locale);

    if (issue) {
      setError(issue);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });

      // The other sessions are ended by the server: leave this one too, and sign in again.
      Alert.alert(t('app.changePassword.doneTitle'), t('app.changePassword.doneMessage'), [
        { text: t('common.actions.ok'), onPress: () => void endSession() },
      ]);
    } catch (err) {
      // Never logged: the request holds both passwords.
      setError(apiErrorMessage(err, t('app.changePassword.failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>{t('app.changePassword.current')}</Text>
          <TextInput
            style={styles.input}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            placeholder="••••••••"
            placeholderTextColor="#a8a29e"
          />

          <Text style={styles.label}>{t('app.changePassword.next')}</Text>
          <TextInput
            style={styles.input}
            value={next}
            onChangeText={setNext}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder={t('app.changePassword.nextPlaceholder')}
            placeholderTextColor="#a8a29e"
          />
          {missing.length > 0 && <Text style={styles.hint}>{missing.join(' ')}</Text>}

          <Text style={styles.label}>{t('app.changePassword.confirm')}</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            placeholderTextColor="#a8a29e"
          />

          <TouchableOpacity style={styles.toggle} onPress={() => setVisible((value) => !value)}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#57534e" />
            <Text style={styles.toggleText}>{visible ? t('app.changePassword.hide') : t('app.changePassword.show')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>{t('app.changePassword.submit')}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fafaf9' },
  container: { flex: 1, backgroundColor: '#fafaf9' },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#44403c', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1917',
    backgroundColor: '#fafaf9',
  },
  hint: { fontSize: 12, color: '#b45309', marginTop: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  toggleText: { fontSize: 14, color: '#57534e' },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { flex: 1, color: '#b91c1c', fontSize: 14 },
});
