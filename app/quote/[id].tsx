import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { isOwnMission } from '../../services/mission-steps';
import { sendQuote } from '../../services/money-screens';
// 🧩 The quote: what it starts from, how it is checked, how it is added up and what the server takes (P2-05)
import {
  MAX_QUOTE_LINES,
  QUOTE_LIMITS,
  VALIDITY_CHOICES,
  apiErrorMessage,
  buildQuote,
  catalogChoices,
  draftFromQuote,
  formatMillimes,
  isBlankLine,
  lineFromChoice,
  newLine,
  prefillDraft,
  prefillHint,
  previewOf,
  quoteBlock,
  readQuote,
  recordIdOf,
  routes,
  taxRateChoices,
  type ArtisanIntervention,
  type ArtisanInterventionQuote,
  type CatalogChoice,
  type PublicCategory,
  type QuoteDraft,
  type QuoteBody,
  type QuoteDraftLine,
  type QuoteProblem,
} from '@/lib/shared';

/** The question before the quote leaves, in the words of what is about to happen. */
function confirmWords(editing: ArtisanInterventionQuote | null, total: string): { title: string; message: string; action: string } {
  if (!editing) return { title: 'Envoyer le devis ?', message: `Total : ${total} TTC.\nLe client le reçoit tout de suite.`, action: 'Envoyer' };

  if (editing.status === 'MODIFICATION_REQUESTED') {
    return { title: 'Renvoyer le devis ?', message: `Nouveau total : ${total} TTC.\nLe client le reçoit de nouveau tout de suite et peut l’accepter.`, action: 'Renvoyer' };
  }

  return { title: 'Enregistrer les modifications ?', message: `Nouveau total : ${total} TTC.\nLe client verra le devis modifié.`, action: 'Enregistrer' };
}

/** The words of a number of days: "3 jours". */
const days = (count: number) => `${count} jour${count > 1 ? 's' : ''}`;

export default function QuoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; edit?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawEdit = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  // A link can carry anything in its address: only a job number and a quote number are looked up.
  const parsedId = recordIdOf(rawId);
  const parsedEdit = rawEdit === undefined || rawEdit === '' ? null : recordIdOf(rawEdit);
  const id = parsedId === null ? undefined : String(parsedId);

  const [mission, setMission] = useState<ArtisanIntervention | null>(null);
  const [editing, setEditing] = useState<ArtisanInterventionQuote | null>(null);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [catalog, setCatalog] = useState<PublicCategory[] | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [sending, setSending] = useState(false);

  // One send at a time, even if the finger is quicker than the screen; and none once the quote is out.
  const working = useRef(false);
  const finished = useRef(false);
  // What the draft was when it opened: leaving with something else asks first.
  const initial = useRef('');
  const onScreen = useRef(id);
  // Set when the artisan chose to abandon the draft: the leaving that follows is not asked about again.
  const leaving = useRef(false);
  const dirtyNow = useRef(false);
  const navigation = useNavigation();

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (id) router.replace(`/mission/${id}` as never);
    else router.replace('/(tabs)');
  }, [router, id]);

  // 1. The mission: its sub-service and its price start the quote, and its quotes say whether one can be made or changed.
  useEffect(() => {
    onScreen.current = id;
    working.current = false;
    finished.current = false;
    leaving.current = false;
    setLoading(true);
    setBlocked(null);
    setMission(null);
    setEditing(null);
    setDraft(null);
    setSending(false);
    setShowProblems(false);
    setShowCatalog(false);

    if (!id || (rawEdit !== undefined && rawEdit !== '' && parsedEdit === null)) {
      setBlocked('Ce lien ne correspond à aucun devis de vos missions.');
      setLoading(false);
      return;
    }

    const wanted = id;
    let cancelled = false;

    (async () => {
      try {
        const job = await call(routes.artisans.mission(wanted));

        if (cancelled || onScreen.current !== wanted) return;

        if (!isOwnMission(job)) {
          setBlocked('Cette mission ne vous est plus attribuée.');
          return;
        }

        const reason = quoteBlock(job, parsedEdit);

        if (reason) {
          setBlocked(reason);
          return;
        }

        const target = parsedEdit === null ? null : (job.quotes ?? []).find((quote) => quote.id === parsedEdit) ?? null;
        const start = target ? draftFromQuote(target) : prefillDraft(job);

        initial.current = JSON.stringify(start);
        setMission(job);
        setEditing(target);
        setDraft(start);
      } catch (error) {
        if (cancelled || onScreen.current !== wanted) return;

        setBlocked(apiErrorMessage(error, 'Impossible de charger la mission. Vérifiez votre connexion et réessayez.'));
      } finally {
        if (!cancelled && onScreen.current === wanted) setLoading(false);
      }
    })();

    // 2. The catalog is a help, not a need: without it the quote is made all the same.
    (async () => {
      try {
        const all = await call(routes.catalog.all());

        if (!cancelled && onScreen.current === wanted) setCatalog(all);
      } catch {
        // no catalog, no suggestions
      }
    })();

    return () => {
      cancelled = true;
      // Off the screen: an answer that comes back later shows nothing (no alert over the screen that is there now).
      onScreen.current = undefined;
    };
  }, [id, rawEdit, parsedEdit]);

  const choices = useMemo<CatalogChoice[]>(
    () => (mission ? catalogChoices(catalog, mission.serviceType, mission.urgency) : []),
    [catalog, mission],
  );

  const preview = useMemo(() => (draft ? previewOf(draft) : null), [draft]);
  const problems = useMemo<QuoteProblem[]>(() => (draft ? readQuote(draft).problems : []), [draft]);

  // 3. Editing the draft
  const change = (patch: Partial<QuoteDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const changeLine = (key: string, patch: Partial<Omit<QuoteDraftLine, 'key'>>) =>
    setDraft((prev) => (prev ? { ...prev, lines: prev.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)) } : prev));

  const removeLine = (key: string) => setDraft((prev) => (prev ? { ...prev, lines: prev.lines.filter((line) => line.key !== key) } : prev));

  /** A line with something in it is asked about; an empty one goes at once. */
  const askToRemove = (line: QuoteDraftLine, index: number) => {
    if (isBlankLine(line)) {
      removeLine(line.key);
      return;
    }

    Alert.alert(`Supprimer la ligne ${index + 1} ?`, line.label.trim() || undefined, [
      { text: 'Garder', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeLine(line.key) },
    ]);
  };

  /** Adds a line; a last line that was left empty is the one that is filled in. */
  const addLine = (line: QuoteDraftLine = newLine()) =>
    setDraft((prev) => {
      if (!prev) return prev;

      const last = prev.lines[prev.lines.length - 1];

      if (last && isBlankLine(last)) return { ...prev, lines: [...prev.lines.slice(0, -1), line] };

      return prev.lines.length >= MAX_QUOTE_LINES ? prev : { ...prev, lines: [...prev.lines, line] };
    });

  const addFromCatalog = (choice: CatalogChoice) => {
    addLine(lineFromChoice(choice));
    setShowCatalog(false);
  };

  const problemsOf = (field: QuoteProblem['field'], line: number | null) =>
    showProblems ? problems.filter((problem) => problem.field === field && problem.line === line) : [];

  const first = (field: QuoteProblem['field'], line: number | null) => problemsOf(field, line)[0]?.message ?? null;

  // 4. Leaving: with something typed, ask first. The arrow, the swipe of an iPhone and the back key of an Android all go through
  // the same question (`beforeRemove`), and while a quote is being sent none of them leaves.
  const dirty = draft !== null && JSON.stringify(draft) !== initial.current;

  // Read by the listener below when someone leaves; kept in an effect, not written while the screen is drawn.
  useEffect(() => {
    dirtyNow.current = dirty;
  });

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaving.current || finished.current) return;

        if (working.current) {
          event.preventDefault();
          return;
        }

        if (!dirtyNow.current) return;

        event.preventDefault();
        Alert.alert('Abandonner le devis ?', 'Ce que vous avez saisi ne sera pas gardé.', [
          { text: 'Continuer', style: 'cancel' },
          {
            text: 'Abandonner',
            style: 'destructive',
            onPress: () => {
              leaving.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ]);
      }),
    [navigation],
  );

  const goBack = () => {
    if (working.current) return;

    leave();
  };

  // 5. Sending: checked, confirmed with the total, then sent. A lost answer is looked for before anything is sent again.
  const submit = () => {
    if (working.current || finished.current || !draft || !mission) return;

    const mode = editing ? 'update' : 'create';
    const built = buildQuote(draft, new Date(), mode);

    if (!built.ok) {
      setShowProblems(true);
      Alert.alert('Devis incomplet', built.problems[0].message);
      return;
    }

    const total = formatMillimes(built.totals.amountTTC);
    const words = confirmWords(editing, total);

    Alert.alert(
      words.title,
      words.message,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: words.action,
          onPress: () => {
            void deliver(built.body, built.totals.amountTTC, mode);
          },
        },
      ],
    );
  };

  const deliver = async (body: QuoteBody, amountTTC: number, mode: 'create' | 'update') => {
    if (working.current || finished.current || !mission || !id) return;

    const wanted = id;
    // Read now: the text of the draft that is being sent (the screen may change while the call is on its way).
    const sentDraft = JSON.stringify(draft);
    let resent = false;

    working.current = true;
    setSending(true);

    try {
      const result = await sendQuote({
        mode,
        send: () => call(editing ? routes.quotes.update(editing.id, body) : routes.quotes.create(wanted, body)),
        // A quote the customer sent back is changed, then sent again: until then the customer cannot accept it.
        resend: async (saved) => {
          const quote = await call(routes.quotes.send(saved.id));

          resent = true;

          return quote;
        },
        quotesBefore: mission.quotes ?? [],
        sent: { title: body.title, amountTTC },
        reload: async () => {
          const job = await call(routes.artisans.mission(wanted));

          return isOwnMission(job) ? job.quotes ?? [] : undefined;
        },
      });

      if (onScreen.current !== wanted) return;

      if (result.kind === 'sent' || result.kind === 'recovered') {
        finished.current = true;
        Alert.alert(
          mode === 'update' ? (resent ? 'Devis renvoyé' : 'Devis modifié') : 'Devis envoyé',
          result.kind === 'recovered'
            ? `La réponse du serveur s’est perdue, mais le devis de ${formatMillimes(amountTTC)} TTC est bien parti.`
            : mode === 'update'
              ? resent
                ? `Le client a reçu votre devis modifié de ${formatMillimes(amountTTC)} TTC et peut maintenant l’accepter.`
                : `Le client voit maintenant le devis de ${formatMillimes(amountTTC)} TTC.`
              : `Le client a reçu votre devis de ${formatMillimes(amountTTC)} TTC.`,
          [{ text: 'OK', onPress: leave }],
        );
        return;
      }

      if (result.kind === 'unknown') {
        // The mission shows the truth: the quote is there or it is not.
        finished.current = true;
        Alert.alert('Pas de réponse du serveur', result.message, [{ text: 'Voir la mission', onPress: leave }]);
        return;
      }

      if (result.kind === 'changed-not-resent') {
        // The changes are saved: leaving is not leaving them behind, and tapping again sends the quote.
        initial.current = sentDraft;
        Alert.alert('Devis non renvoyé', result.message);
        return;
      }

      Alert.alert('Erreur', result.message);
    } finally {
      if (onScreen.current === wanted) {
        working.current = false;
        setSending(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  if (blocked || !draft || !mission || !preview) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={leave} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={24} color="#D4AF37" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Devis</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.blocked}>
          <Ionicons name="information-circle-outline" size={40} color="#94a3b8" />
          <Text style={styles.blockedText}>{blocked ?? 'Ce devis n’est pas disponible.'}</Text>
          <TouchableOpacity style={styles.secondary} onPress={leave}>
            <Text style={styles.secondaryText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const rates = taxRateChoices(draft.taxRate);
  const lastLine = draft.lines[draft.lines.length - 1];
  // Full when no line can be added: the twentieth is there and filled (an empty last line is the one that gets filled in).
  const full = draft.lines.length >= MAX_QUOTE_LINES && !(lastLine && isBlankLine(lastLine));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Modifier le devis' : 'Nouveau devis'} · #{id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {editing?.status === 'MODIFICATION_REQUESTED' ? (
          <View style={styles.asked}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#f59e0b" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.askedTitle}>Le client demande une modification</Text>
              {editing.clientNote ? <Text style={styles.askedNote}>« {editing.clientNote} »</Text> : null}
              <Text style={styles.askedNote}>Changez le devis puis renvoyez-le : le client ne peut pas l’accepter avant.</Text>
            </View>
          </View>
        ) : null}

        {/* Title */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TITRE</Text>
          <TextInput
            style={[styles.input, first('title', null) ? styles.inputBad : null]}
            value={draft.title}
            onChangeText={(title) => change({ title })}
            placeholder="Ex. : Réparation d’une fuite"
            placeholderTextColor="#64748b"
            maxLength={QUOTE_LIMITS.title + 20}
            editable={!sending}
            accessibilityLabel="Titre du devis"
          />
          {first('title', null) ? <Text style={styles.error}>{first('title', null)}</Text> : null}
        </View>

        {/* Lines */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LIGNES</Text>
          {!editing ? <Text style={styles.hint}>{prefillHint(mission)}</Text> : null}

          {draft.lines.map((line, index) => (
            <View key={line.key} style={styles.line}>
              <View style={styles.lineHead}>
                <Text style={styles.lineNumber}>Ligne {index + 1}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => askToRemove(line, index)}
                  disabled={sending || draft.lines.length === 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la ligne ${index + 1}`}
                  hitSlop={8}
                  style={[styles.remove, draft.lines.length === 1 ? styles.removeOff : null]}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, first('label', index) ? styles.inputBad : null]}
                value={line.label}
                onChangeText={(label) => changeLine(line.key, { label })}
                placeholder="Ce que couvre la ligne"
                placeholderTextColor="#64748b"
                maxLength={QUOTE_LIMITS.label + 20}
                editable={!sending}
                accessibilityLabel={`Ligne ${index + 1} : ce que couvre la ligne`}
              />
              {first('label', index) ? <Text style={styles.error}>{first('label', index)}</Text> : null}

              <View style={styles.numbers}>
                <View style={styles.numberBox}>
                  <Text style={styles.fieldLabel}>Quantité</Text>
                  <TextInput
                    style={[styles.input, first('quantity', index) ? styles.inputBad : null]}
                    value={line.quantity}
                    onChangeText={(quantity) => changeLine(line.key, { quantity })}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor="#64748b"
                    editable={!sending}
                    accessibilityLabel={`Ligne ${index + 1} : quantité`}
                  />
                </View>
                <View style={styles.numberBox}>
                  <Text style={styles.fieldLabel}>Prix unitaire (DT)</Text>
                  <TextInput
                    style={[styles.input, first('unitPrice', index) ? styles.inputBad : null]}
                    value={line.unitPrice}
                    onChangeText={(unitPrice) => changeLine(line.key, { unitPrice })}
                    keyboardType="decimal-pad"
                    placeholder="0,000"
                    placeholderTextColor="#64748b"
                    editable={!sending}
                    accessibilityLabel={`Ligne ${index + 1} : prix unitaire en dinars`}
                  />
                </View>
              </View>
              {first('quantity', index) ? <Text style={styles.error}>{first('quantity', index)}</Text> : null}
              {first('unitPrice', index) ? <Text style={styles.error}>{first('unitPrice', index)}</Text> : null}
              {first('total', index) ? <Text style={styles.error}>{first('total', index)}</Text> : null}

              <Text style={styles.lineTotal}>
                {preview.lines[index] !== null ? `Total de la ligne : ${formatMillimes(preview.lines[index] as number)}` : 'Total de la ligne : –'}
              </Text>
            </View>
          ))}

          {first('lines', null) ? <Text style={styles.error}>{first('lines', null)}</Text> : null}

          <TouchableOpacity style={[styles.secondary, (sending || full) && styles.disabled]} onPress={() => addLine()} disabled={sending || full}>
            <Ionicons name="add" size={18} color="#D4AF37" />
            <Text style={styles.secondaryText}>Ajouter une ligne</Text>
          </TouchableOpacity>

          {choices.length > 0 ? (
            <>
              <TouchableOpacity style={[styles.secondary, (sending || full) && styles.disabled]} onPress={() => setShowCatalog((open) => !open)} disabled={sending || full}>
                <Ionicons name="list" size={18} color="#D4AF37" />
                <Text style={styles.secondaryText}>{showCatalog ? 'Masquer le catalogue' : 'Ajouter depuis le catalogue'}</Text>
              </TouchableOpacity>

              {showCatalog
                ? choices.map((choice) => (
                    <TouchableOpacity key={choice.id} style={styles.choice} onPress={() => addFromCatalog(choice)} accessibilityRole="button">
                      <View style={{ flex: 1 }}>
                        <Text style={styles.choiceName}>{choice.name}</Text>
                        {choice.duration ? <Text style={styles.choiceMeta}>{choice.duration}</Text> : null}
                      </View>
                      <Text style={styles.choicePrice}>{choice.priceText}</Text>
                    </TouchableOpacity>
                  ))
                : null}
            </>
          ) : null}
        </View>

        {/* Tax and validity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TVA</Text>
          <View style={styles.chips}>
            {rates.map((rate) => (
              <TouchableOpacity key={rate} style={[styles.chip, draft.taxRate === rate && styles.chipOn]} onPress={() => change({ taxRate: rate })} disabled={sending} accessibilityRole="radio" accessibilityState={{ selected: draft.taxRate === rate }}>
                <Text style={[styles.chipText, draft.taxRate === rate && styles.chipTextOn]}>{String(rate).replace('.', ',')} %</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.cardTitle, { marginTop: 8 }]}>VALIDITÉ</Text>
          <View style={styles.chips}>
            {editing ? (
              <TouchableOpacity style={[styles.chip, draft.validDays === null && styles.chipOn]} onPress={() => change({ validDays: null })} disabled={sending} accessibilityRole="radio" accessibilityState={{ selected: draft.validDays === null }}>
                <Text style={[styles.chipText, draft.validDays === null && styles.chipTextOn]}>Inchangée</Text>
              </TouchableOpacity>
            ) : null}
            {VALIDITY_CHOICES.map((count) => (
              <TouchableOpacity key={count} style={[styles.chip, draft.validDays === count && styles.chipOn]} onPress={() => change({ validDays: count })} disabled={sending} accessibilityRole="radio" accessibilityState={{ selected: draft.validDays === count }}>
                <Text style={[styles.chipText, draft.validDays === count && styles.chipTextOn]}>{days(count)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Après ce délai, le client ne peut plus accepter le devis.</Text>
        </View>

        {/* Note */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>NOTE POUR LE CLIENT (FACULTATIF)</Text>
          <TextInput
            style={[styles.input, styles.multiline, first('description', null) ? styles.inputBad : null]}
            value={draft.description}
            onChangeText={(description) => change({ description })}
            placeholder="Matériel fourni, conditions, délais…"
            placeholderTextColor="#64748b"
            multiline
            maxLength={QUOTE_LIMITS.description + 50}
            editable={!sending}
            accessibilityLabel="Note pour le client"
          />
          {first('description', null) ? <Text style={styles.error}>{first('description', null)}</Text> : null}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <TotalRow label="Total HT" value={formatMillimes(preview.amountHT)} />
          <TotalRow label={`TVA (${String(draft.taxRate).replace('.', ',')} %)`} value={formatMillimes(preview.taxAmount)} />
          <TotalRow label="Total TTC" value={formatMillimes(preview.amountTTC)} strong />
          {!preview.complete ? <Text style={styles.hint}>Le total sera complet quand toutes les lignes seront remplies.</Text> : null}
        </View>

        {first('quote', null) ? <Text style={styles.error}>{first('quote', null)}</Text> : null}
        {first('tax', null) ? <Text style={styles.error}>{first('tax', null)}</Text> : null}
        {first('validity', null) ? <Text style={styles.error}>{first('validity', null)}</Text> : null}

        <TouchableOpacity style={[styles.primary, sending && styles.disabled]} onPress={submit} disabled={sending} accessibilityRole="button">
          {sending ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <>
              <Text style={styles.primaryText}>{editing ? (editing.status === 'MODIFICATION_REQUESTED' ? 'Renvoyer au client' : 'Enregistrer les modifications') : 'Envoyer le devis au client'}</Text>
              <Ionicons name="send" size={18} color="#0f172a" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, strong && styles.totalStrong]}>{value}</Text>
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

  card: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155', gap: 10 },
  cardTitle: { fontSize: 12, color: '#D4AF37', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  hint: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  error: { color: '#f87171', fontSize: 13, lineHeight: 18 },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#0f172a',
    fontSize: 16,
  },
  inputBad: { borderColor: '#ef4444' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },

  line: { backgroundColor: '#0f172a', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: '#334155' },
  lineHead: { flexDirection: 'row', alignItems: 'center' },
  lineNumber: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeOff: { opacity: 0.3 },
  asked: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 16, padding: 14 },
  askedTitle: { color: '#fbbf24', fontSize: 15, fontWeight: '700' },
  askedNote: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  numbers: { flexDirection: 'row', gap: 12 },
  numberBox: { flex: 1, gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 12 },
  lineTotal: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', textAlign: 'right' },

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

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  choiceName: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  choiceMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  choicePrice: { color: '#D4AF37', fontSize: 14, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  chipOn: { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.15)' },
  chipText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#D4AF37' },

  totals: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#D4AF37', gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#94a3b8', fontSize: 15 },
  totalValue: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  totalStrong: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

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
