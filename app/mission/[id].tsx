import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'; // ✅ Added Stack import
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ Import API
import api from '../../services/api';

export default function MissionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 

  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch Mission Details on Load
  useEffect(() => {
    const fetchMissionDetails = async () => {
      try {
        const response = await api.get(`/interventions/${id}`);
        setMission(response.data);
      } catch (error) {
        console.error("Error fetching details:", error);
        Alert.alert("Erreur", "Impossible de charger les détails.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchMissionDetails();
  }, [id]);

  // 2. Helper to open Maps
  const openMap = () => {
    if (!mission?.address) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(mission.address)}`,
      android: `geo:0,0?q=${encodeURIComponent(mission.address)}`,
    });
    Linking.openURL(url || "");
  };

  // 3. Helper to Call Client
  const callClient = () => {
    if (mission?.client?.phone) {
      Linking.openURL(`tel:${mission.client.phone}`);
    } else {
      Alert.alert("Info", "Pas de numéro de téléphone disponible.");
    }
  };

  // 4. Update Status (Start / Finish)
  const updateStatus = async (newStatus: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/interventions/${id}`, { status: newStatus });
      
      setMission((prev: any) => ({ ...prev, status: newStatus }));
      
      Alert.alert("Succès", `Statut mis à jour : ${getStatusLabel(newStatus)}`);
      
      if (newStatus === 'COMPLETED') {
        router.back(); 
      }
    } catch (error) {
      console.error("Update Error:", error);
      Alert.alert("Erreur", "Impossible de mettre à jour le statut.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusLabel = (s: string) => {
    switch(s) {
      case 'PENDING': return 'EN ATTENTE';
      case 'ACCEPTED': return 'ACCEPTÉ';
      case 'IN_PROGRESS': return 'EN COURS';
      case 'COMPLETED': return 'TERMINÉ';
      case 'CANCELED': return 'ANNULÉ';
      default: return s;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        {/* ✅ HIDE DEFAULT HEADER ALSO WHILE LOADING */}
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!mission) return null;

  return (
    <View style={styles.container}>
      {/* ✅ HIDE DEFAULT HEADER (This removes the duplicate) */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* YOUR CUSTOM HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1c1c1e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails Mission #{id}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* STATUS BANNER */}
        <View style={[styles.statusBanner, { 
          backgroundColor: mission.status === 'COMPLETED' ? '#34C759' : 
                          mission.status === 'IN_PROGRESS' ? '#8b5cf6' : '#007AFF' 
        }]}>
          <Text style={styles.statusBannerText}>Statut : {getStatusLabel(mission.status)}</Text>
        </View>

        {/* CLIENT INFO CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>CLIENT</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.title}>{mission.client?.name || "Client Inconnu"}</Text>
              <Text style={styles.subtitle}>{mission.client?.phone || "Non renseigné"}</Text>
            </View>
            <TouchableOpacity onPress={callClient} style={styles.iconButton}>
              <Ionicons name="call" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* MISSION DETAILS CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>SERVICE</Text>
          <Text style={styles.bodyBold}>{mission.serviceType}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.label}>DESCRIPTION</Text>
          <Text style={styles.body}>{mission.description || "Aucune description fournie."}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>ADRESSE</Text>
          <TouchableOpacity onPress={openMap} style={styles.row}>
            <Ionicons name="location" size={20} color="#007AFF" />
            <Text style={styles.address}>{mission.address}</Text>
          </TouchableOpacity>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionContainer}>
          {actionLoading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <>
              {/* Button to START */}
              {(mission.status === 'ACCEPTED' || mission.status === 'PENDING') && (
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={() => updateStatus('IN_PROGRESS')}
                >
                  <Text style={styles.primaryButtonText}>Démarrer l'intervention</Text>
                </TouchableOpacity>
              )}

              {/* Button to FINISH */}
              {mission.status === 'IN_PROGRESS' && (
                <TouchableOpacity 
                  style={styles.successButton} 
                  onPress={() => updateStatus('COMPLETED')}
                >
                  <Text style={styles.primaryButtonText}>Marquer comme terminé</Text>
                </TouchableOpacity>
              )}

              {/* Completed State */}
              {mission.status === 'COMPLETED' && (
                <View style={styles.completedBox}>
                  <Ionicons name="checkmark-circle" size={48} color="#34C759" />
                  <Text style={styles.completedText}>Mission Terminée</Text>
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1c1c1e' },
  backButton: { padding: 4 },
  content: { padding: 20 },
  statusBanner: { padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  statusBannerText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  label: { fontSize: 12, color: '#8E8E93', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700', color: '#000' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 4 },
  body: { fontSize: 16, color: '#3A3A3C', lineHeight: 24 },
  bodyBold: { fontSize: 18, fontWeight: '600', color: '#000' },
  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  address: { fontSize: 16, color: '#007AFF', marginLeft: 8, fontWeight: '500', flex: 1 },
  iconButton: { backgroundColor: '#34C759', padding: 12, borderRadius: 24 },
  actionContainer: { marginTop: 10, paddingBottom: 40 },
  primaryButton: { backgroundColor: '#007AFF', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 5 },
  successButton: { backgroundColor: '#34C759', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#34C759', shadowOpacity: 0.3, shadowRadius: 5 },
  primaryButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  completedBox: { alignItems: 'center', padding: 20 },
  completedText: { marginTop: 10, fontSize: 18, fontWeight: 'bold', color: '#34C759' },
});