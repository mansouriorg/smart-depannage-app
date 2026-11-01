import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DeclineModal } from '@/components/DeclineModal';
import {
  awayText,
  isUrgent,
  msLeft,
  offerOfJob,
  outcomeText,
  recordIdOf,
  serviceName,
  stateNow,
  timeLeftAccessibility,
  timeLeftText,
  type MissionRejectionReason,
} from '@/lib/shared';
import { call } from '../../services/call';
import { useI18n } from '../../services/i18n';
import { mirrorStyle, spacing } from '../../services/i18n-core';
import { acceptOffer, refuseOffer } from '../../services/offer-actions';
import { noteOfferAnswered } from '../../services/offer-answers';
import { isSigningOut } from '../../services/road-state';
import { useOffers } from '../../services/use-offers';

/**
 * A mission offered to the technician (P3-07): what it is, where, how far, and the time left to answer. This is the screen a push about an offer
 * opens. The job is not the technician's until they accept, so the mission screen (which sends away anyone who does not hold the job) is not used.
 *
 * What it shows comes from the list of offers, which carries the job as the board shows it (no way to reach the customer) while the offer is open, and
 * only how the offer ended afterwards. While the offer is open the list is read every fifteen seconds, so that a mission taken by another technician is
 * told here within moments. The first technician to accept gets the job: the accept goes straight to the server and is never kept for later.
 */
export default function OfferScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = recordIdOf(Array.isArray(rawId) ? rawId[0] : rawId);

  const focused = useIsFocused();
  const focusedNow = useRef(focused);

  // Written by an effect (not while drawing), and false again when the screen goes away: a screen taken off the stack does not draw once more with
  // `focused` false, so without the cleanup the answer to an accept made before it left would still find the screen "in front".
  useEffect(() => {
    focusedNow.current = focused;

    return () => {
      focusedNow.current = false;
    };
  }, [focused]);

  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const offers = useOffers(focused && appActive);
  const [working, setWorking] = useState(false);
  const [declining, setDeclining] = useState(false);
  // The screen is on its way out (to the mission after an accept, back after a refusal): it shows a wait, not "no longer available" for the moment
  // between the answer being noted and the screen going.
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setAppActive(next === 'active'));

    setAppActive(AppState.currentState === 'active');

    return () => subscription.remove();
  }, []);

  /** Back to where the technician came from; from a push there is nothing to go back to, so the home screen. */
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const offer = id === null ? null : offerOfJob(offers.offers, id);
  const state = offer ? stateNow(offer, offers.now, offers.offset) : null;
  const left = offer ? msLeft(offer.expiresAt, offers.now, offers.offset) : 0;

  // The job became the technician's (accepted here, or from the home screen): it is theirs to work on, on the mission screen. Once, and only while
  // this is the screen in front (a technician who went back while the answer was on its way is not sent to the mission from wherever they are).
  const sentToMission = useRef(false);

  const toMission = useCallback(() => {
    if (id === null || sentToMission.current || !focusedNow.current || isSigningOut()) return;

    sentToMission.current = true;
    setLeaving(true);
    router.replace(`/mission/${id}` as Href);
  }, [id, router]);

  useEffect(() => {
    if (offer?.state === 'accepted') toMission();
  }, [offer?.state, toMission]);

  const job = offer?.job as ({ serviceType: string; description?: string; address?: string; distanceKm?: number | null } | null | undefined);

  const accept = async () => {
    if (busy.current || id === null || isSigningOut()) return;

    busy.current = true;
    setWorking(true);

    let answer: Awaited<ReturnType<typeof acceptOffer>>;
    let after: Awaited<ReturnType<typeof offers.refresh>> | null = null;

    try {
      answer = await acceptOffer(call, id, locale);

      if (answer.kind !== 'failed') noteOfferAnswered(id);
      // No answer was heard (no signal, a server in trouble): the server may still have accepted. The list says so; the button stays busy until it has
      // been read, so that a second press does not start another accept beside this one.
      else after = await offers.refresh();
    } finally {
      busy.current = false;
      setWorking(false);
    }

    if (answer.kind === 'accepted') {
      toMission();

      return;
    }

    if (answer.kind === 'gone') {
      // The server says the job is no longer there: its sentence now; the list read again says how the offer ended.
      Alert.alert(t('app.offers.screenTitle'), answer.message);
      void offers.refresh();

      return;
    }

    // The list read after an answer that was not heard says whether the job is the technician's, and then no "try again" is told over it.
    if (after && offerOfJob(after.offers, id)?.state === 'accepted') {
      toMission();

      return;
    }

    Alert.alert(t('app.offers.screenTitle'), answer.message);
  };

  const refuse = async (reason: MissionRejectionReason, note: string) => {
    if (busy.current || id === null || isSigningOut()) return;

    busy.current = true;
    setWorking(true);

    try {
      const answer = await refuseOffer(call, id, reason, note, locale);

      if (answer.kind !== 'failed') noteOfferAnswered(id);

      if (answer.kind === 'refused') {
        // Off this screen first: an alert shown while the window of reasons is still closing can be lost on an iPhone. The word comes a moment
        // later, on the screen they land on.
        setDeclining(false);
        if (focusedNow.current) {
          setLeaving(true);
          leave();
        }
        setTimeout(() => Alert.alert(t('app.offers.refusedTitle'), t('app.offers.refusedMessage')), 400);

        return;
      }

      if (answer.kind === 'gone') {
        // The job is no longer there to refuse: the window closes, the word comes a moment later, and the list says how the offer ended.
        setDeclining(false);
        setTimeout(() => Alert.alert(t('app.offers.screenTitle'), answer.message), 400);
        void offers.refresh();

        return;
      }

      // Not recorded (no signal, a server in trouble): the window stays open with the reason and the note the technician wrote, to try again.
      Alert.alert(t('app.offers.screenTitle'), answer.message);
    } finally {
      busy.current = false;
      setWorking(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={leave} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.actions.back')}>
        <Ionicons name="arrow-back" size={24} color="#D4AF37" style={mirrorStyle(locale)} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t('app.offers.screenTitle')}</Text>
      <View style={styles.headerSpace} />
    </View>
  );

  // A link that is not a mission number opens nothing.
  if (id === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.center}>
          <Text style={styles.outcome}>{t('app.common.missionLinkInvalid')}</Text>
        </View>
      </View>
    );
  }

  if (!offers.loaded) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.center}>
          {offers.failed ? (
            <>
              <Text style={styles.outcome}>{t('app.offers.loadFailed')}</Text>
              <TouchableOpacity style={styles.secondary} onPress={() => void offers.refresh()} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t('common.actions.retry')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="large" color="#D4AF37" />
          )}
        </View>
      </View>
    );
  }

  const urgent = isUrgent(left);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView contentContainerStyle={styles.content}>
        {state === 'open' && job ? (
          <>
            <View style={[styles.timerBox, urgent && styles.timerBoxUrgent]} accessible accessibilityLabel={timeLeftAccessibility(locale, left)}>
              <Ionicons name="time-outline" size={22} color={urgent ? '#ef4444' : '#D4AF37'} />
              <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>{timeLeftText(locale, left)}</Text>
            </View>
            <Text style={styles.hint}>{t('app.offers.firstWins')}</Text>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="construct" size={20} color="#D4AF37" />
                <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.service')}</Text>
              </View>
              <Text style={styles.serviceText}>{serviceName(job.serviceType, locale)}</Text>

              <View style={styles.divider} />

              <View style={styles.cardHeaderRow}>
                <Ionicons name="document-text" size={20} color="#D4AF37" />
                <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.description')}</Text>
              </View>
              <Text style={styles.bodyText}>{job.description || t('app.mission.noDescription')}</Text>

              <View style={styles.divider} />

              <View style={styles.cardHeaderRow}>
                <Ionicons name="location" size={20} color="#D4AF37" />
                <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.address')}</Text>
              </View>
              <Text style={styles.bodyText}>{job.address || t('app.mission.notProvided')}</Text>
              {awayText(locale, job.distanceKm) ? <Text style={styles.away}>{awayText(locale, job.distanceKm)}</Text> : null}
            </View>

            <View style={styles.actions}>
              {working ? (
                <ActivityIndicator size="large" color="#D4AF37" />
              ) : (
                <>
                  <TouchableOpacity style={styles.accept} onPress={() => void accept()} accessibilityRole="button">
                    <Text style={styles.acceptText}>{t('app.offers.accept')}</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#0f172a" style={{ marginStart: 8 }} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.refuse} onPress={() => setDeclining(true)} accessibilityRole="button">
                    <Text style={styles.refuseText}>{t('app.offers.refuse')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.center}>
            {leaving ? (
              <ActivityIndicator size="large" color="#D4AF37" />
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={56} color="#94a3b8" />
                {/* How the offer ended; an offer nobody has (too old to be listed, or never made to this technician) is simply not available */}
                <Text style={styles.outcome}>{outcomeText(locale, state ?? 'withdrawn', offer ? offer.because : 'closed')}</Text>
                <TouchableOpacity style={styles.secondary} onPress={leave} accessibilityRole="button">
                  <Text style={styles.secondaryText}>{t('app.offers.back')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <DeclineModal visible={declining} question={t('app.offers.refuseQuestion')} busy={working} onCancel={() => setDeclining(false)} onConfirm={refuse} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30, flexGrow: 1 },
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
  headerSpace: { width: 40 },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#1e293b' },
  content: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  timerBoxUrgent: { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.6)' },
  timerText: { color: '#D4AF37', fontSize: 22, fontWeight: '800' },
  timerTextUrgent: { color: '#ef4444' },
  hint: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  serviceText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bodyText: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  away: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
  actions: { gap: 12, marginTop: 8 },
  accept: {
    backgroundColor: '#10b981',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: { color: '#0f172a', fontSize: 17, fontWeight: 'bold' },
  refuse: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  refuseText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  outcome: { color: '#e2e8f0', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  secondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  secondaryText: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },
});
