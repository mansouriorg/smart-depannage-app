import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ Import API
import { apiErrorMessage } from '../../services/api';
import { call } from '../../services/call';
import { useI18n } from '../../services/i18n';
import { mirrorStyle, spacing } from '../../services/i18n-core';
import { offlineQueue, useOfflineQueue } from '../../services/offline';
import { QueueSaveError, isPutOff, problemMessage, type SubmitResult } from '../../services/offline-queue';
import {
  declineBody,
  isOwnMission,
  stepFailure,
  stepRoute,
  waitingFor,
  withAnswer,
} from '../../services/mission-steps';
// 📸 Caméra de preuve : photo + GPS + heure, prises sur le téléphone
import ProofOfWorkCamera from '@/components/ProofOfWorkCamera';
import { CashCard } from '@/components/CashCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { DeclineModal } from '@/components/DeclineModal';
import { MissionTimeline } from '@/components/MissionTimeline';
import { QuoteCard } from '@/components/QuoteCard';
import { StatusBadge } from '@/components/StatusBadge';
import { noteMissionLeft, noteMissionStatus } from '../../services/road-state';
// 🧩 The flow of a mission, the words of a status and the coordinates of a job, shared with the server and the other apps (P1-09, P1-15)
import {
  apiErrorStatus,
  canQuote,
  coordinatesOf,
  failureKind,
  missionBucketOf,
  missionRefusal,
  navigationLinks,
  nextMissionStep,
  recordIdOf,
  routes,
  serviceName,
  statusWithPending,
  type ArtisanIntervention,
  type CashPosition,
  type MissionRejectionReason,
  type MissionStep,
} from '@/lib/shared';

/** The icon of the button of each step. */
const STEP_ICONS: Record<MissionStep, keyof typeof Ionicons.glyphMap> = {
  accept: 'checkmark-circle',
  'on-the-way': 'car',
  arrived: 'location',
  start: 'play',
  complete: 'camera',
};

/**
 * The last copy of each job that was read with a signal (in this run of the app, for the person whose session it was). A job opened again
 * without a signal shows this copy, so that a technician who pressed "arrivé" in a basement, went back to the list and opens the job again can
 * still press "commencer" or take the photo, instead of being sent back with an error.
 */
const lastRead = new Map<string, ArtisanIntervention>();
const LAST_READ_MAX = 30;

function rememberJob(userId: string | null, job: ArtisanIntervention) {
  if (!userId) return;

  const key = `${userId}:${job.id}`;

  lastRead.delete(key);
  lastRead.set(key, job);

  for (const oldest of [...lastRead.keys()].slice(0, Math.max(0, lastRead.size - LAST_READ_MAX))) lastRead.delete(oldest);
}

function recallJob(userId: string | null, id: string): ArtisanIntervention | null {
  return userId ? (lastRead.get(`${userId}:${id}`) ?? null) : null;
}

export default function MissionDetailScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  // A link can carry anything in its address (a path, a number too large): only a job number is looked up.
  const parsedId = recordIdOf(rawId);
  const id = parsedId === null ? undefined : String(parsedId);

  const [mission, setMission] = useState<ArtisanIntervention | null>(null);
  // What the customer has paid and what is left (P2-05); null until it is read, and when it could not be read.
  const [position, setPosition] = useState<CashPosition | null>(null);
  // The figures on the card are old: the artisan came back from a screen that may have changed them, or the last read failed.
  const [positionStale, setPositionStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 📸 Affiche la caméra de preuve de travail
  const [showCamera, setShowCamera] = useState(false);
  // Le choix de la raison d'un refus
  const [declining, setDeclining] = useState(false);

  // What the phone is still holding (P3-06): the steps of this mission that have not left yet move the status on the screen, so that a technician
  // without a signal who pressed "arrivé" is offered "commencer", and the photo that closes the job is shown as waiting, not as sent.
  const offline = useOfflineQueue();
  const heldSteps = offline.entries.filter((entry) => entry.missionId === id).map((entry) => entry.step);
  const heldRoad = heldSteps.filter((step) => step !== 'complete');
  const proofHeld = heldSteps.includes('complete');
  const shownStatus = mission ? statusWithPending(mission.status, heldRoad).status : null;
  // What really waits (could not go at its first try), as opposed to what is only being sent: only that is said to wait.
  const stuck = offline.entries.filter((entry) => entry.missionId === id && isPutOff(entry)).map((entry) => entry.step);
  // The job on screen is a copy read earlier (the last read failed): said, so that an old status is not taken for the server's word.
  const [fromCopy, setFromCopy] = useState(false);

  // The copy to show if the job is opened again without a signal.
  useEffect(() => {
    if (mission) rememberJob(offline.userId, mission);
  }, [mission, offline.userId]);

  // One action at a time, even if the finger is quicker than the screen.
  const working = useRef(false);
  // The mission on screen: an answer that comes back for another one (a push opened a different mission) is dropped.
  const onScreen = useRef(id);
  // The newest read wins: an older answer that comes back late is dropped (the mission, and the position, each count their own).
  const askedMission = useRef(0);
  const askedPosition = useRef(0);
  // An answer of the server that was applied to the job on screen is newer than any read that was on its way: that read is dropped when it
  // comes back (it would put the old status back, with the action that made the new one already gone from the list).
  const answered = useRef(0);
  const drawn = useRef(false);
  // An action of this job left while the first read of the job was still on its way: that read may have been served before it. One more read
  // follows it (a silent one) once the job is on screen. A read started on the spot would overtake the first, and a first read that is lost with
  // nothing drawn leaves nothing to look at.
  const staleOpen = useRef(false);

  drawn.current = mission !== null;

  /** Puts the job's new state (the answer of the server to an action) on screen: it is newer than any read on its way, and no copy any more. */
  const applyAnswer = useCallback((answer: Partial<ArtisanIntervention>, fromServer = true) => {
    if (drawn.current) answered.current += 1;

    setMission((prev) => (prev ? withAnswer(prev, answer) : prev));

    if (fromServer) setFromCopy(false);
  }, []);
  // A money screen is opened once per tap, even for a double tap (two builders stacked would each send the quote).
  const opening = useRef(false);

  /** Back to where the artisan came from; from a push there is nothing to go back to, so the list. */
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  /**
   * The cash position of the mission, for the cash card. It only decorates the screen, so a failure is silent: the card
   * stays as it was (or absent), and the cash screen reads it again anyway.
   */
  const loadPosition = useCallback(async (wanted: string) => {
    const mine = (askedPosition.current += 1);

    try {
      const read = await call(routes.cash.position(wanted));

      if (onScreen.current === wanted && askedPosition.current === mine) {
        setPosition(read);
        setPositionStale(false);
      }
    } catch (error) {
      console.error('Error fetching the cash position:', apiErrorStatus(error) ?? (error as Error)?.message);

      // The figures on the card, if any, are no longer known to be right: the button waits for the next read.
      if (onScreen.current === wanted && askedPosition.current === mine) setPositionStale(true);
    }
  }, []);

  // 1. Fetch Mission Details: on opening (a failure takes the artisan back), on a pull to refresh (a failure is
  // told, the screen stays) and to check again after the server refused an action (silent: the refusal was told).
  const load = useCallback(
    async (mode: 'open' | 'refresh' | 'recheck' | 'follow') => {
      const wanted = id;

      // The job is on screen. If an action of it left while this first read was on its way, one more read follows, silently: that read takes over
      // from this one (its answer is the one that counts), so this one's `finally` would not clear the spinner, and it is cleared here.
      const followUp = () => {
        if (!staleOpen.current) return;

        staleOpen.current = false;
        setLoading(false);
        setRefreshing(false);
        void loadNow.current('follow');
      };

      if (!wanted) {
        Alert.alert(t('app.mission.notFoundTitle'), t('app.common.missionLinkInvalid'));
        setLoading(false);
        leave();
        return;
      }

      const mine = (askedMission.current += 1);
      const answeredBefore = answered.current;

      // The position does not wait for the mission: a mission that cannot be read must not leave old figures on the card.
      void loadPosition(wanted);

      try {
        const job = await call(routes.artisans.mission(wanted));

        if (onScreen.current !== wanted || askedMission.current !== mine) return;

        // An answer was applied while this read was on its way: the read is older than what is on screen.
        if (answered.current !== answeredBefore) return;

        // The board's copy comes back for a job nobody holds: it is no longer this artisan's.
        if (!isOwnMission(job)) {
          if (mode !== 'recheck') Alert.alert(t('app.mission.unavailableTitle'), t('app.mission.notYours'));
          leave();
          return;
        }

        drawn.current = true;
        setMission(job);
        setFromCopy(false);
        followUp();
      } catch (error) {
        console.error('Error fetching details:', apiErrorStatus(error) ?? (error as Error)?.message);

        if (onScreen.current !== wanted || askedMission.current !== mine) return;

        if (mode === 'recheck') return;

        // The read that was to bring the job up to date after an action of it left did not come back: what is drawn may be older than the server.
        if (mode === 'follow') {
          // (unless the server has answered an action since: that answer is newer than the copy)
          if (answered.current === answeredBefore) setFromCopy(true);

          return;
        }

        // No answer, or one that says nothing about the job (a gateway, too many requests, a timeout): when the job is being opened, the copy read
        // last time, if there is one, so that the actions the phone holds can be followed and the next one made. The server's own "no" (a job that
        // is gone) still takes the technician back, and a pull to refresh keeps what is drawn and says that it failed.
        if (mode === 'open' && failureKind(error) === 'retry') {
          const copy = recallJob(offlineQueue.getSnapshot().userId, wanted);

          if (copy) {
            drawn.current = true;
            setMission(copy);
            setFromCopy(true);
            followUp();

            return;
          }
        }

        Alert.alert(t('common.states.error'), apiErrorMessage(error, mode === 'open' ? t('app.mission.loadDetailsFailed') : t('app.mission.refreshFailed')));

        if (mode === 'open') leave();
      } finally {
        if (onScreen.current === wanted && askedMission.current === mine) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id, leave, loadPosition, t],
  );

  // The home screen sends the position while a job is on the way, arrived or at work; it is not shown while this screen is, so it is told here
  // (a technician who is offline and sets out from the notification would otherwise send nothing until they went back).
  useEffect(() => {
    if (mission) noteMissionStatus(mission.id, shownStatus ?? mission.status);
  }, [mission, shownStatus]);

  // The effect below must not start again because `load` was made again: it follows the mission, nothing else.
  const loadNow = useRef(load);

  useEffect(() => {
    loadNow.current = load;
  }, [load]);

  useEffect(() => {
    onScreen.current = id;
    working.current = false;
    opening.current = false;
    askedMission.current += 1;
    askedPosition.current += 1;
    staleOpen.current = false;
    drawn.current = false;
    setMission(null);
    setFromCopy(false);
    setPosition(null);
    setPositionStale(false);
    setLoading(true);
    setShowCamera(false);
    setDeclining(false);
    setActionLoading(false);

    loadNow.current('open');

    return () => {
      // Off the screen: an answer that comes back later changes nothing and shows nothing.
      onScreen.current = undefined;
    };
  }, [id]);

  // Back from the quote screen or the cash screen (or from any other screen): the quote and the payment may have moved.
  // The first focus is the opening, which the effect above already loads.
  const opened = useRef(false);

  useFocusEffect(
    useCallback(() => {
      opening.current = false;

      if (!opened.current) {
        opened.current = true;
        return;
      }

      // The first read of the job is still on its way (nothing is drawn): it brings the figures. A read started now would overtake it, and lost, it
      // would leave the screen empty.
      if (!drawn.current) return;

      // The quote and the payment may have moved while another screen was open: the card waits for the new figures.
      setPositionStale(true);
      loadNow.current('recheck');
    }, []),
  );

  /** Opens a screen of the money flow, once per tap. */
  const openScreen = (href: Href) => {
    if (opening.current) return;

    opening.current = true;
    router.push(href);
    // If the screen never took the focus (the push was refused), the card works again after a moment.
    setTimeout(() => {
      opening.current = false;
    }, 1500);
  };

  // What becomes of the actions the phone kept, while this screen is on (P3-06): an action this screen is waiting for answers itself; one that
  // leaves later (the signal came back) brings the job up to date here, and the photo that closes the job is told.
  useEffect(() => {
    return offlineQueue.onEvent((event) => {
      if (event.entry.missionId !== onScreen.current) return;

      const closing = event.entry.step === 'complete';

      // The answer of the server to a step is the job as it is now, whoever is waiting for it: applying it twice (this screen's own tap gets it
      // as well) changes nothing, and an earlier action that leaves while a later one is being made must not be lost to the screen.
      if (event.kind === 'sent' && !closing && event.answer && typeof event.answer === 'object') {
        applyAnswer(event.answer as Partial<ArtisanIntervention>);

        // Nothing is drawn yet (the first read is on its way): there was nothing to apply it to, and that read may be older than this answer.
        if (!drawn.current) staleOpen.current = true;

        return;
      }

      // The photo that closes the job has left (or the server had it): the job is over, whatever the screen read before.
      if (closing && event.kind !== 'dropped') applyAnswer({ status: 'COMPLETED' } as Partial<ArtisanIntervention>, false);

      // This screen is waiting for this very action and tells what became of it itself.
      if (working.current) return;

      if (event.kind === 'sent' && closing) {
        Alert.alert(t('app.mission.doneTitle'), event.needsReview ? t('app.mission.doneReview') : t('app.mission.doneSecured'));
      }

      // With nothing drawn yet, a read started now would overtake the first one (and, lost, would leave the screen empty): that one is followed.
      if (drawn.current) loadNow.current('recheck');
      else staleOpen.current = true;
    });
  }, [t, applyAnswer]);

  // 2. Navigation: the point the job is at, in the artisan's map application (not the street name, which can be anywhere)
  const point = coordinatesOf(mission);

  const openNavigation = async () => {
    if (!mission || !point) return;

    const links = navigationLinks(point, t('app.mission.mapLabel', { ref: `#${mission.id}` }));
    const first = Platform.select({ ios: links.apple, android: links.geo, default: links.google });

    try {
      await Linking.openURL(first);
    } catch {
      try {
        await Linking.openURL(links.google);
      } catch {
        Alert.alert(t('app.mission.navigationTitle'), t('app.mission.noMapApp'));
      }
    }
  };

  // 3. Helper to Call Client
  const callClient = () => {
    if (mission?.client?.phone) {
      Linking.openURL(`tel:${mission.client.phone}`);
    } else {
      Alert.alert(t('app.mission.infoTitle'), t('app.mission.noPhone'));
    }
  };

  /** Runs one action: one at a time, and if the server says no, the screen is brought back to what the server says. */
  const perform = async (work: () => Promise<void>, failure: string) => {
    if (working.current) return;

    const wanted = id;

    working.current = true;
    setActionLoading(true);

    try {
      await work();
    } catch (error) {
      console.error("Mission action error:", apiErrorStatus(error) ?? (error as Error)?.message);
      Alert.alert(t('common.states.error'), apiErrorMessage(error, failure));

      // The server answered "no": the job may have moved (cancelled, handed to somebody else). Look again.
      if (apiErrorStatus(error) !== null) loadNow.current('recheck');
    } finally {
      if (onScreen.current === wanted) {
        working.current = false;
        setActionLoading(false);
      }
    }
  };

  /** Hands an action to the queue of the phone; null when the phone could not keep it (the technician was told). */
  const keep = async (input: Parameters<typeof offlineQueue.submit>[0]): Promise<SubmitResult | null> => {
    try {
      return await offlineQueue.submit(input);
    } catch (error) {
      if (!(error instanceof QueueSaveError)) throw error;

      const reason = (error.cause as Error | undefined)?.message ?? error.message;

      console.error('The phone could not keep the action:', reason);
      // Not every failure is a phone that cannot write: no session open (it ended while the screen stayed open), a list of waiting actions or a
      // session that cannot be read for a moment (a locked phone) are told as what they are.
      const text =
        reason === 'NO_SESSION'
          ? t('app.offline.noSession')
          : reason === 'QUEUE_NOT_READ' || reason === 'SESSION_UNREADABLE'
            ? t('app.offline.notRead')
            : t('app.offline.saveFailed');

      Alert.alert(t('common.states.error'), text);

      return null;
    }
  };

  // 4. One step. Accepting needs the server's answer on the spot (another technician may have taken the job), so it goes straight. On the way,
  // arrived and start are kept on the phone and sent at once, or when the signal is back (P3-06); each is recorded by the server with the time
  // it was made, not the time it arrived.
  const runStep = (step: Exclude<MissionStep, 'complete'>) =>
    step === 'accept'
      ? perform(async () => {
          const wanted = id as string;
          const answer = await call(stepRoute(step, wanted));

          if (onScreen.current === wanted) applyAnswer(answer);
        }, stepFailure(step, locale))
      : perform(async () => {
          const wanted = id as string;
          const result = await keep({ missionId: wanted, step });

          if (!result || onScreen.current !== wanted) return;

          switch (result.kind) {
            case 'sent':
              if (result.answer && typeof result.answer === 'object') applyAnswer(result.answer as Partial<ArtisanIntervention>);
              else loadNow.current('recheck');
              return;
            case 'kept':
              Alert.alert(t('app.offline.keptTitle'), t('app.offline.keptStep'));
              return;
            case 'refused':
              // Told here, so it does not wait in the banner as well.
              void offlineQueue.dismiss(result.problem.id);
              Alert.alert(t('common.states.error'), result.reason ?? problemMessage(result.problem, locale));
              loadNow.current('recheck');
              return;
            case 'ignored':
              return;
          }
        }, stepFailure(step, locale));

  // 5. Refuse, or give back: the reason goes to the dispatcher, the mission goes back to the queue
  const decline = (reason: MissionRejectionReason, note: string) =>
    perform(async () => {
      const wanted = id as string;

      await call(routes.artisans.decline(wanted, declineBody(reason, note)));

      // Home is told at once: the job is no longer the artisan's, whatever its list still says until it reads it again.
      noteMissionLeft(wanted);

      // Off this mission first: it is no longer the artisan's, and an alert shown while the window of reasons is
      // still closing can be lost on an iPhone. The word comes a moment later, on the screen they land on.
      setDeclining(false);
      leave();
      setTimeout(() => Alert.alert(t('app.mission.returnedTitle'), t('app.mission.returnedMessage')), 400);
    }, t('app.mission.returnFailed'));

  // 6. 📸 Envoi de la preuve de travail (photo, GPS et heure venant de la caméra). La photo est d'abord gardée sur le téléphone, puis envoyée
  // tout de suite, ou dès que le réseau revient (P3-06) : une mission terminée sans signal part quand la connexion revient.
  const handlePhotoCapture = async (proofData: any) => {
    if (working.current) return;

    const wanted = id as string;

    working.current = true;
    setShowCamera(false);
    setActionLoading(true);

    try {
      const latitude = Number(proofData.latitude);
      const longitude = Number(proofData.longitude);

      if (!proofData.uri || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        Alert.alert(t('common.states.error'), t('app.mission.proofFailed'));
        return;
      }

      const result = await keep({
        missionId: wanted,
        step: 'complete',
        photo: {
          uri: String(proofData.uri),
          latitude,
          longitude,
          // Le serveur juge la photo avec la précision du GPS et l'indicateur de position simulée.
          ...(typeof proofData.accuracy === 'number' ? { accuracy: proofData.accuracy } : {}),
          ...(typeof proofData.mocked === 'boolean' ? { mocked: proofData.mocked } : {}),
          capturedAt: String(proofData.timestamp),
        },
      });

      if (!result) return;

      switch (result.kind) {
        case 'sent':
          // Une photo que le serveur n'a pas pu valider seul est gardée et regardée par l'équipe.
          // (Home is told at once by the queue: the work is over, whatever its list still says until it reads it again.)
          Alert.alert(t('app.mission.doneTitle'), result.needsReview ? t('app.mission.doneReview') : t('app.mission.doneSecured'));
          // (Only when this job is still the one on screen: the technician may have gone elsewhere while the photo was on its way.)
          if (onScreen.current === wanted) leave();
          return;
        case 'kept':
          Alert.alert(t('app.offline.keptTitle'), t('app.offline.keptProof'));
          return;
        case 'refused': {
          // Told here, so it does not wait in the banner as well.
          void offlineQueue.dismiss(result.problem.id);

          const text = result.reason ?? problemMessage(result.problem, locale);

          // Le serveur dit quoi faire ("rapprochez-vous du lieu", "prenez une nouvelle photo"...).
          if (result.code === 'PROOF_REJECTED') {
            Alert.alert(t('app.mission.photoRefusedTitle'), text, [
              { text: t('common.actions.cancel'), style: 'cancel' },
              { text: t('app.mission.retakePhoto'), onPress: () => onScreen.current === wanted && setShowCamera(true) },
            ]);
          } else {
            Alert.alert(t('common.states.error'), text);

            // The job may have been closed by a first try whose answer got lost, or taken away: look again.
            loadNow.current('recheck');
          }

          return;
        }
        case 'ignored':
          return;
      }
    } catch (error: any) {
      console.error("Erreur d'upload:", error?.response?.status ?? error?.message);
      Alert.alert(t('common.states.error'), apiErrorMessage(error, t('app.mission.proofFailed')));
    } finally {
      // (Only when this job is still the one on screen: a screen that now shows another one has been given a clean state.)
      if (onScreen.current === wanted) {
        working.current = false;
        setActionLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  if (!mission) return null;

  // 📸 Écran caméra de preuve de travail
  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ProofOfWorkCamera
          onCaptureComplete={handlePhotoCapture}
          onCancel={() => setShowCamera(false)}
        />
      </View>
    );
  }

  // The status the technician works from: the server's, moved on by the steps the phone still holds. While the photo that closes the job waits
  // for a signal the job is not over: no next step is offered, and the job is not shown as finished.
  const status = shownStatus ?? mission.status;
  const next = proofHeld ? null : nextMissionStep(status, undefined, locale);
  // Handing the job back needs the server's answer on the spot, and would cross what the phone still holds.
  const refusal = heldSteps.length > 0 ? null : missionRefusal(mission.status, locale);
  // What the job waits for is said by the server's own status: while the phone holds actions, that sentence would speak of a moment that has not
  // reached the customer yet ("the customer knows you are on your way"), and the line under it says what is true.
  const hint = stuck.length > 0 ? null : waitingFor(status, locale);
  // The customer is told of the departure and the arrival, not of the start of the work: a held start says only that it waits.
  const heldHint = stuck.includes('complete')
    ? t('app.offline.missionProofWaiting')
    : stuck.some((step) => step === 'on-the-way' || step === 'arrived')
      ? t('app.offline.missionWaiting')
      : stuck.length > 0
        ? t('app.offline.missionWaitingStart')
        : null;
  const over = !proofHeld && missionBucketOf(status) === 'done';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={leave} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.actions.back')}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" style={mirrorStyle(locale)} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('app.mission.header', { ref: `#${id}` })}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNow.current('refresh');
            }}
            tintColor="#D4AF37"
            colors={["#D4AF37"]}
          />
        }
      >
        {/* What the phone keeps until it has a signal (P3-06): inside the scroll, so that it never pushes the buttons off a small screen */}
        <OfflineBanner flush />

        <View style={styles.statusBanner}>
          <StatusBadge status={status} large />
          {hint ? <Text style={styles.statusHint}>{hint}</Text> : null}
          {heldHint ? <Text style={styles.statusHint}>{heldHint}</Text> : null}
          {fromCopy ? <Text style={styles.statusHint}>{t('app.offline.oldCopy')}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="person" size={20} color="#D4AF37" />
            <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.client')}</Text>
          </View>
          
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.clientName}>{mission.client?.name || t('app.common.unknownClient')}</Text>
              <Text style={[styles.clientPhone, mission.client?.phone ? styles.ltr : null]}>{mission.client?.phone || t('app.mission.notProvided')}</Text>
            </View>
            <TouchableOpacity onPress={callClient} style={styles.callButton}>
              <Ionicons name="call" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
             <Ionicons name="construct" size={20} color="#D4AF37" />
             <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.service')}</Text>
          </View>
          <Text style={styles.serviceText}>{serviceName(mission.serviceType, locale)}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.cardHeaderRow}>
             <Ionicons name="document-text" size={20} color="#D4AF37" />
             <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.description')}</Text>
          </View>
          <Text style={styles.bodyText}>{mission.description || t('app.mission.noDescription')}</Text>

          <View style={styles.divider} />

          <View style={styles.cardHeaderRow}>
             <Ionicons name="location" size={20} color="#D4AF37" />
             <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.address')}</Text>
          </View>
          <Text style={styles.addressText}>{mission.address}</Text>

          {point ? (
            <TouchableOpacity onPress={openNavigation} style={styles.routeButton} accessibilityRole="button">
              <Ionicons name="navigate" size={18} color="#D4AF37" />
              <Text style={styles.routeButtonText}>{t('app.mission.route')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noPointText}>{t('app.mission.noPoint')}</Text>
          )}
        </View>

        {/* The quote: shown from the acceptance of the mission, and afterwards if there is one to talk about */}
        {canQuote(mission.status) || (mission.quotes ?? []).length > 0 ? (
          <QuoteCard
            job={mission}
            onMake={() => openScreen(`/quote/${mission.id}` as Href)}
            onChange={(quoteId) => openScreen(`/quote/${mission.id}?edit=${quoteId}` as Href)}
          />
        ) : null}

        {/* The payment: the card shows itself only when the mission has something to pay */}
        <CashCard position={position} stale={positionStale} onCollect={() => openScreen(`/cash/${mission.id}` as Href)} />

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="git-commit" size={20} color="#D4AF37" />
            <Text style={[styles.cardTitle, { letterSpacing: spacing(locale, 1) }]}>{t('app.mission.timeline')}</Text>
          </View>
          <MissionTimeline job={{ ...mission, status }} />
        </View>

        <View style={styles.actionContainer}>
          {actionLoading ? (
            <ActivityIndicator size="large" color="#D4AF37" />
          ) : (
            <>
              {/* The next step, and only that one (the status table says which) */}
              {next && (
                <TouchableOpacity 
                  style={next.needsProof ? styles.successButton : styles.primaryButton} 
                  onPress={() => (next.step === 'complete' ? setShowCamera(true) : runStep(next.step))}
                >
                  <Text style={next.needsProof ? styles.successButtonText : styles.primaryButtonText}>{next.label}</Text>
                  <Ionicons name={STEP_ICONS[next.step]} size={20} color={next.needsProof ? '#fff' : '#0f172a'} style={{ marginStart: 8 }}/>
                </TouchableOpacity>
              )}

              {refusal && (
                <TouchableOpacity style={styles.refuseButton} onPress={() => setDeclining(true)}>
                  <Text style={styles.refuseButtonText}>{refusal.label}</Text>
                </TouchableOpacity>
              )}

              {over && (
                <View style={styles.completedBox}>
                  <Ionicons name="checkmark-done-circle" size={64} color="#10b981" />
                  <Text style={styles.completedText}>{t('app.mission.over')}</Text>
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>

      <DeclineModal
        visible={declining}
        question={refusal?.question ?? t('app.decline.question')}
        busy={actionLoading}
        onCancel={() => setDeclining(false)}
        onConfirm={decline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a' 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#0f172a'
  },
  
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
  headerTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  backButton: { 
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#1e293b'
  },
  
  content: { 
    padding: 20,
    paddingBottom: 40 
  },

  statusBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  statusHint: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },

  card: { 
    backgroundColor: '#1e293b', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8
  },
  cardTitle: { 
    fontSize: 12, 
    color: '#D4AF37', 
    fontWeight: '800', 
    textTransform: 'uppercase' 
  },
  
  rowBetween: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 8
  },
  clientName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff' 
  },
  clientPhone: { 
    fontSize: 16, 
    color: '#94a3b8', 
    marginTop: 4 
  },
  // A phone number keeps its order inside a right-to-left screen.
  ltr: {
    writingDirection: 'ltr',
  },
  callButton: { 
    backgroundColor: '#D4AF37', 
    padding: 14, 
    borderRadius: 14,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.4,
    shadowRadius: 5
  },

  serviceText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#fff',
    marginBottom: 4 
  },
  bodyText: { 
    fontSize: 16, 
    color: '#cbd5e1', 
    lineHeight: 24 
  },
  addressText: { 
    fontSize: 16, 
    color: '#e2e8f0', 
    fontWeight: '500', 
    flex: 1,
    marginEnd: 10
  },
  
  routeButton: {
    marginTop: 12,
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
  routeButtonText: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },
  noPointText: { marginTop: 10, color: '#94a3b8', fontSize: 13, lineHeight: 18 },

  divider: { 
    height: 1, 
    backgroundColor: '#334155', 
    marginVertical: 16 
  },

  actionContainer: { 
    marginTop: 10, 
    paddingBottom: 40 
  },
  primaryButton: { 
    backgroundColor: '#D4AF37', 
    height: 56, 
    borderRadius: 16, 
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#D4AF37', 
    shadowOpacity: 0.3, 
    shadowRadius: 5 
  },
  primaryButtonText: { 
    color: '#0f172a', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  successButton: { 
    backgroundColor: '#10b981', 
    height: 56, 
    borderRadius: 16, 
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#10b981', 
    shadowOpacity: 0.3, 
    shadowRadius: 5 
  },
  successButtonText: {
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold'
  },
  refuseButton: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  refuseButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  completedBox: { 
    alignItems: 'center', 
    padding: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10b981'
  },
  completedText: { 
    marginTop: 12, 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#10b981' 
  },
});
