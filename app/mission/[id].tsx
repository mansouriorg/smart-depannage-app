import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import api, { UPLOAD_TIMEOUT_MS, apiErrorMessage } from '../../services/api';
import { call } from '../../services/call';
import {
  STEP_FAILURE,
  declineBody,
  isOwnMission,
  stepRoute,
  waitingFor,
  withAnswer,
} from '../../services/mission-steps';
// 📸 Caméra de preuve : photo + GPS + heure, prises sur le téléphone
import ProofOfWorkCamera from '@/components/ProofOfWorkCamera';
import { DeclineModal } from '@/components/DeclineModal';
import { MissionTimeline } from '@/components/MissionTimeline';
import { StatusBadge } from '@/components/StatusBadge';
// 🧩 The flow of a mission, the words of a status and the coordinates of a job, shared with the server and the other apps (P1-09, P1-15)
import {
  apiErrorStatus,
  coordinatesOf,
  missionBucketOf,
  missionRefusal,
  navigationLinks,
  nextMissionStep,
  recordIdOf,
  routes,
  serviceNameOf,
  type ArtisanIntervention,
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

export default function MissionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  // A link can carry anything in its address (a path, a number too large): only a job number is looked up.
  const parsedId = recordIdOf(rawId);
  const id = parsedId === null ? undefined : String(parsedId);

  const [mission, setMission] = useState<ArtisanIntervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 📸 Affiche la caméra de preuve de travail
  const [showCamera, setShowCamera] = useState(false);
  // Le choix de la raison d'un refus
  const [declining, setDeclining] = useState(false);

  // One action at a time, even if the finger is quicker than the screen.
  const working = useRef(false);
  // The mission on screen: an answer that comes back for another one (a push opened a different mission) is dropped.
  const onScreen = useRef(id);

  /** Back to where the artisan came from; from a push there is nothing to go back to, so the list. */
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  // 1. Fetch Mission Details: on opening (a failure takes the artisan back), on a pull to refresh (a failure is
  // told, the screen stays) and to check again after the server refused an action (silent: the refusal was told).
  const load = useCallback(
    async (mode: 'open' | 'refresh' | 'recheck') => {
      const wanted = id;

      if (!wanted) {
        Alert.alert('Mission introuvable', 'Ce lien ne correspond à aucune de vos missions.');
        setLoading(false);
        leave();
        return;
      }

      try {
        const job = await call(routes.interventions.oneAsArtisan(wanted));

        if (onScreen.current !== wanted) return;

        // The board's copy comes back for a job nobody holds: it is no longer this artisan's.
        if (!isOwnMission(job)) {
          if (mode !== 'recheck') Alert.alert('Mission indisponible', 'Cette mission ne vous est plus attribuée.');
          leave();
          return;
        }

        setMission(job);
      } catch (error) {
        console.error("Error fetching details:", error);

        if (mode === 'recheck') return;

        Alert.alert("Erreur", apiErrorMessage(error, mode === 'open' ? "Impossible de charger les détails." : "Impossible d'actualiser la mission."));

        if (mode === 'open') leave();
      } finally {
        if (onScreen.current === wanted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id, leave],
  );

  // The effect below must not start again because `load` was made again: it follows the mission, nothing else.
  const loadNow = useRef(load);

  useEffect(() => {
    loadNow.current = load;
  }, [load]);

  useEffect(() => {
    onScreen.current = id;
    working.current = false;
    setMission(null);
    setLoading(true);
    setShowCamera(false);
    setDeclining(false);
    setActionLoading(false);

    loadNow.current('open');
  }, [id]);

  // 2. Navigation: the point the job is at, in the artisan's map application (not the street name, which can be anywhere)
  const point = coordinatesOf(mission);

  const openNavigation = async () => {
    if (!mission || !point) return;

    const links = navigationLinks(point, `Mission #${mission.id}`);
    const first = Platform.select({ ios: links.apple, android: links.geo, default: links.google });

    try {
      await Linking.openURL(first);
    } catch {
      try {
        await Linking.openURL(links.google);
      } catch {
        Alert.alert("Navigation", "Aucune application de cartes n'a pu être ouverte.");
      }
    }
  };

  // 3. Helper to Call Client
  const callClient = () => {
    if (mission?.client?.phone) {
      Linking.openURL(`tel:${mission.client.phone}`);
    } else {
      Alert.alert("Info", "Pas de numéro de téléphone disponible.");
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
      Alert.alert("Erreur", apiErrorMessage(error, failure));

      // The server answered "no": the job may have moved (cancelled, handed to somebody else). Look again.
      if (apiErrorStatus(error) !== null) loadNow.current('recheck');
    } finally {
      if (onScreen.current === wanted) {
        working.current = false;
        setActionLoading(false);
      }
    }
  };

  // 4. One step: accept, on the way, arrived, start (each one is recorded by the server, with the time)
  const runStep = (step: Exclude<MissionStep, 'complete'>) =>
    perform(async () => {
      const wanted = id as string;
      const answer = await call(stepRoute(step, wanted));

      if (onScreen.current === wanted) setMission((prev) => (prev ? withAnswer(prev, answer) : prev));
    }, STEP_FAILURE[step]);

  // 5. Refuse, or give back: the reason goes to the dispatcher, the mission goes back to the queue
  const decline = (reason: MissionRejectionReason, note: string) =>
    perform(async () => {
      const wanted = id as string;

      await call(routes.artisans.decline(wanted, declineBody(reason, note)));

      // Off this mission first: it is no longer the artisan's, and an alert shown while the window of reasons is
      // still closing can be lost on an iPhone. The word comes a moment later, on the screen they land on.
      setDeclining(false);
      leave();
      setTimeout(() => Alert.alert("Mission rendue", "L'équipe a été prévenue et va chercher un autre technicien."), 400);
    }, "La mission n'a pas pu être rendue. Réessayez.");

  // 6. 📸 Envoi de la preuve de travail (photo, GPS et heure venant de la caméra)
  const handlePhotoCapture = async (proofData: any) => {
    if (working.current) return;

    working.current = true;
    setShowCamera(false);
    setActionLoading(true);

    try {
      const formData = new FormData();
      
      formData.append('photo', {
        uri: proofData.uri,
        name: `proof_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      formData.append('latitude', proofData.latitude.toString());
      formData.append('longitude', proofData.longitude.toString());
      // Le serveur juge la photo avec la précision du GPS et l'indicateur de position simulée.
      if (typeof proofData.accuracy === 'number') formData.append('accuracy', String(proofData.accuracy));
      if (typeof proofData.mocked === 'boolean') formData.append('mocked', String(proofData.mocked));
      formData.append('timestamp', proofData.timestamp);

      const response = await api.post(`/interventions/${id}/complete-work`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Une photo sur une connexion mobile faible dépasse vite 10 secondes.
        timeout: UPLOAD_TIMEOUT_MS,
      });

      // Une photo que le serveur n'a pas pu valider seul est gardée et regardée par l'équipe.
      const checked = response.data?.proof?.status === 'NEEDS_REVIEW';

      Alert.alert(
        "Félicitations !",
        checked
          ? "Mission terminée. Votre photo sera vérifiée par l'équipe."
          : "Mission terminée et preuve sécurisée enregistrée.",
      );

      leave();
      
    } catch (error: any) {
      console.error("Erreur d'upload:", error?.response?.status ?? error?.message);

      // Le serveur dit quoi faire ("rapprochez-vous du lieu", "prenez une nouvelle photo"...).
      const refused = error?.response?.status === 400 && error?.response?.data?.code === 'PROOF_REJECTED';
      const message = apiErrorMessage(error, "La preuve n'a pas pu être envoyée. Veuillez réessayer.");

      if (refused) {
        Alert.alert("Photo refusée", message, [
          { text: "Annuler", style: "cancel" },
          { text: "Reprendre la photo", onPress: () => setShowCamera(true) },
        ]);
      } else {
        Alert.alert("Erreur", message);

        // The job may have been closed by a first try whose answer got lost: look again.
        if (apiErrorStatus(error) !== null) loadNow.current('recheck');
      }
    } finally {
      working.current = false;
      setActionLoading(false);
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

  const next = nextMissionStep(mission.status);
  const refusal = missionRefusal(mission.status);
  const hint = waitingFor(mission.status);
  const over = missionBucketOf(mission.status) === 'done';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={leave} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails Mission #{id}</Text>
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
        
        <View style={styles.statusBanner}>
          <StatusBadge status={mission.status} large />
          {hint ? <Text style={styles.statusHint}>{hint}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="person" size={20} color="#D4AF37" />
            <Text style={styles.cardTitle}>CLIENT</Text>
          </View>
          
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.clientName}>{mission.client?.name || "Client Inconnu"}</Text>
              <Text style={styles.clientPhone}>{mission.client?.phone || "Non renseigné"}</Text>
            </View>
            <TouchableOpacity onPress={callClient} style={styles.callButton}>
              <Ionicons name="call" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
             <Ionicons name="construct" size={20} color="#D4AF37" />
             <Text style={styles.cardTitle}>SERVICE</Text>
          </View>
          <Text style={styles.serviceText}>{serviceNameOf(mission.serviceType)}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.cardHeaderRow}>
             <Ionicons name="document-text" size={20} color="#D4AF37" />
             <Text style={styles.cardTitle}>DESCRIPTION</Text>
          </View>
          <Text style={styles.bodyText}>{mission.description || "Aucune description fournie."}</Text>

          <View style={styles.divider} />

          <View style={styles.cardHeaderRow}>
             <Ionicons name="location" size={20} color="#D4AF37" />
             <Text style={styles.cardTitle}>ADRESSE</Text>
          </View>
          <Text style={styles.addressText}>{mission.address}</Text>

          {point ? (
            <TouchableOpacity onPress={openNavigation} style={styles.routeButton} accessibilityRole="button">
              <Ionicons name="navigate" size={18} color="#D4AF37" />
              <Text style={styles.routeButtonText}>Itinéraire vers le lieu</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noPointText}>La position GPS de ce lieu n'est pas enregistrée : suivez l'adresse ci-dessus.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="git-commit" size={20} color="#D4AF37" />
            <Text style={styles.cardTitle}>DÉROULEMENT</Text>
          </View>
          <MissionTimeline job={mission} />
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
                  <Ionicons name={STEP_ICONS[next.step]} size={20} color={next.needsProof ? '#fff' : '#0f172a'} style={{marginLeft: 8}}/>
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
                  <Text style={styles.completedText}>Mission Terminée</Text>
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>

      <DeclineModal
        visible={declining}
        question={refusal?.question ?? 'Pourquoi rendez-vous cette mission ?'}
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
    letterSpacing: 1,
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
    marginRight: 10
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
