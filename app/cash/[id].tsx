import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { call } from '../../services/call';
import { collectFailure } from '../../services/money-screens';
// 🧩 What is left to take, what the artisan typed, the key of the tap and the words after it (P2-05)
import {
  amountText,
  apiErrorMessage,
  collectedWords,
  formatDinars,
  formatMillimes,
  keyFor,
  readCashAmount,
  recordIdOf,
  routes,
  toDinars,
  toMillimes,
  type CashPosition,
  type CollectAttempts,
} from '@/lib/shared';

/** The longest note the server keeps with a collection. */
const NOTE_MAX = 500;

/** The call that records the cash. */
function callCollect(job: string, millimes: number, requestKey: string, note: string) {
  return call(
    routes.cash.collect(job, {
      amount: toDinars(millimes),
      requestKey,
      ...(note.trim() ? { note: note.trim().slice(0, NOTE_MAX) } : {}),
    }),
  );
}

export default function CashScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  // A link can carry anything in its address: only a job number is looked up.
  const parsedId = recordIdOf(rawId);
  const id = parsedId === null ? undefined : String(parsedId);

  const [position, setPosition] = useState<CashPosition | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showProblem, setShowProblem] = useState(false);
  const [sending, setSending] = useState(false);

  // One tap at a time; and the key of each amount that was tried, so that a tap after a lost answer is the same request.
  const working = useRef(false);
  const finished = useRef(false);
  const attempts = useRef<CollectAttempts | null>(null);
  const onScreen = useRef(id);
  // The newest read of the position wins: an older answer that comes back late is dropped.
  const asked = useRef(0);
  const navigation = useNavigation();

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (id) router.replace(`/mission/${id}` as never);
    else router.replace('/(tabs)');
  }, [router, id]);

  /** Reads what is left to take. `quiet` is for the look after the server said no: the refusal was told already. */
  const load = useCallback(
    async (quiet: boolean) => {
      const wanted = id;

      if (!wanted) {
        setFailure('Ce lien ne correspond à aucune de vos missions.');
        setLoading(false);
        return;
      }

      const mine = (asked.current += 1);

      try {
        const answer = await call(routes.cash.position(wanted));

        if (onScreen.current !== wanted || asked.current !== mine) return;

        setPosition(answer);
        setFailure(null);
      } catch (error) {
        if (onScreen.current !== wanted || asked.current !== mine || quiet) return;

        setFailure(apiErrorMessage(error, 'Impossible de charger le montant à encaisser. Vérifiez votre connexion et réessayez.'));
      } finally {
        if (onScreen.current === wanted && asked.current === mine) setLoading(false);
      }
    },
    [id],
  );

  const loadNow = useRef(load);

  useEffect(() => {
    loadNow.current = load;
  }, [load]);

  useEffect(() => {
    onScreen.current = id;
    working.current = false;
    finished.current = false;
    attempts.current = null;
    asked.current += 1;
    setPosition(null);
    setFailure(null);
    setLoading(true);
    setAmount('');
    setNote('');
    setShowProblem(false);
    setSending(false);

    loadNow.current(false);

    return () => {
      // Off the screen: an answer that comes back later shows nothing (no alert over the screen that is there now).
      onScreen.current = undefined;
    };
  }, [id]);

  // While a collection is on its way the screen does not leave: the artisan would not see how it ended.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (working.current && !finished.current) event.preventDefault();
      }),
    [navigation],
  );

  const read = position ? readCashAmount(amount, position) : null;

  const submit = () => {
    if (working.current || finished.current || !position || !position.canCollect) return;

    const checked = readCashAmount(amount, position);

    if (!checked.ok) {
      setShowProblem(true);
      Alert.alert('Montant à vérifier', checked.message);
      return;
    }

    Alert.alert(
      'Confirmer l’encaissement',
      `Vous confirmez avoir reçu ${formatMillimes(checked.millimes)} en espèces du client ?\n\nVous gardez les espèces. La commission de la plateforme sur ce montant est ajoutée à ce que vous lui devez.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            void collect(checked.millimes);
          },
        },
      ],
    );
  };

  const collect = async (millimes: number) => {
    if (working.current || finished.current || !id) return;

    const wanted = id;
    // The same amount on the same job keeps its key, whatever was tried in between: if the answer of a first try was lost, the
    // server answers it again instead of writing twice.
    const tried = keyFor(attempts.current, wanted, millimes);

    attempts.current = tried.attempts;
    working.current = true;
    setSending(true);

    let answer: Awaited<ReturnType<typeof callCollect>>;

    try {
      answer = await callCollect(wanted, millimes, tried.key, note);
    } catch (error) {
      if (onScreen.current === wanted) {
        working.current = false;
        setSending(false);

        const failed = collectFailure(error);

        Alert.alert('Erreur', failed.message);

        // Whatever went wrong, what is left to take may not be what is on the screen (a first try that was lost may have been
        // written): look again, quietly, the failure was told already.
        void loadNow.current(true);
      }

      return;
    }

    // The cash is recorded: nothing after this point may say otherwise.
    if (onScreen.current !== wanted) return;

    finished.current = true;
    attempts.current = null;
    working.current = false;
    setSending(false);

    let words = 'L’encaissement est enregistré.';

    try {
      words = collectedWords(answer);
    } catch {
      // an answer that cannot be read is still an answer: the cash is recorded
    }

    Alert.alert('Encaissement enregistré', words, [{ text: 'OK', onPress: leave }]);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={leave} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Retour" disabled={sending}>
        <Ionicons name="arrow-back" size={24} color="#D4AF37" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Encaissement · #{id}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  if (!position) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.blocked}>
          <Ionicons name="information-circle-outline" size={40} color="#94a3b8" />
          <Text style={styles.blockedText}>{failure ?? 'Impossible de charger le montant à encaisser.'}</Text>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => {
              setLoading(true);
              void load(false);
            }}
          >
            <Text style={styles.secondaryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const remainingMillimes = position.remaining !== null ? Math.max(toMillimes(position.remaining), 0) : 0;
  const problem = showProblem && read && !read.ok ? read.message : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {position.total !== null && position.remaining !== null ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>CE QUE LE CLIENT DOIT</Text>
            <View style={styles.figures}>
              <Row label={position.document === 'INVOICE' ? 'Facture' : 'Devis accepté'} value={formatDinars(position.total)} />
              <Row label="Déjà payé" value={formatDinars(position.received)} />
              <Row label="Reste à payer" value={formatDinars(Math.max(position.remaining, 0))} strong />
            </View>
            {position.collected > 0 ? <Text style={styles.hint}>Vous avez déjà déclaré {formatDinars(position.collected)} en espèces sur cette mission.</Text> : null}
          </View>
        ) : null}

        {position.canCollect ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>MONTANT REÇU EN ESPÈCES (DT)</Text>
            <TextInput
              style={[styles.input, problem ? styles.inputBad : null]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0,000"
              placeholderTextColor="#64748b"
              editable={!sending}
              accessibilityLabel="Montant reçu en espèces"
            />
            {problem ? <Text style={styles.error}>{problem}</Text> : null}

            <TouchableOpacity style={[styles.secondary, sending && styles.disabled]} onPress={() => setAmount(amountText(remainingMillimes))} disabled={sending}>
              <Ionicons name="cash-outline" size={18} color="#D4AF37" />
              <Text style={styles.secondaryText}>Tout le reste ({formatMillimes(remainingMillimes)})</Text>
            </TouchableOpacity>

            <Text style={[styles.cardTitle, { marginTop: 8 }]}>NOTE (FACULTATIF)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={note}
              onChangeText={setNote}
              placeholder="Un mot pour l’équipe"
              placeholderTextColor="#64748b"
              multiline
              maxLength={NOTE_MAX}
              editable={!sending}
              accessibilityLabel="Note facultative pour l’équipe"
            />

            <Text style={styles.hint}>
              Vous gardez les espèces. Une commission est ajoutée à ce que vous devez à la plateforme : vous la retrouvez dans l’onglet Gains.
            </Text>

            <TouchableOpacity style={[styles.primary, sending && styles.disabled]} onPress={submit} disabled={sending} accessibilityRole="button">
              {sending ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <Text style={styles.primaryText}>Enregistrer l’encaissement</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#0f172a" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Ionicons name={position.remaining !== null && position.remaining <= 0 ? 'checkmark-circle' : 'information-circle-outline'} size={22} color={position.remaining !== null && position.remaining <= 0 ? '#10b981' : '#94a3b8'} />
              <Text style={styles.reason}>{position.reason ?? 'Aucun encaissement possible pour le moment.'}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#1e293b' },

  content: { padding: 20, paddingBottom: 60, gap: 16 },

  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  blockedText: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, textAlign: 'center' },

  card: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155', gap: 12 },
  cardTitle: { fontSize: 12, color: '#D4AF37', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  figures: { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: '#94a3b8', fontSize: 14, flexShrink: 1 },
  value: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  strong: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  hint: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },
  error: { color: '#f87171', fontSize: 13, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reason: { flex: 1, color: '#cbd5e1', fontSize: 15, lineHeight: 22 },

  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#0f172a',
    fontSize: 20,
    fontWeight: '600',
  },
  inputBad: { borderColor: '#ef4444' },
  multiline: { minHeight: 72, fontSize: 16, fontWeight: '400', textAlignVertical: 'top' },

  secondary: {
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
  secondaryText: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },

  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#D4AF37',
  },
  primaryText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
});
