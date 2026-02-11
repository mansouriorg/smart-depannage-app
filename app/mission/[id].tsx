import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
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

  // Helper for Status Color
  const getStatusColor = (s: string) => {
    switch(s) {
      case 'PENDING': return '#f59e0b'; // Orange
      case 'ACCEPTED': return '#D4AF37'; // Gold
      case 'IN_PROGRESS': return '#8b5cf6'; // Violet
      case 'COMPLETED': return '#10b981'; // Green
      default: return '#64748b';
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* CUSTOM HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails Mission #{id}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* STATUS BANNER */}
        <View style={[styles.statusBanner, { borderColor: getStatusColor(mission.status) }]}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(mission.status) }]} />
          <Text style={[styles.statusBannerText, { color: getStatusColor(mission.status) }]}>
            {getStatusLabel(mission.status)}
          </Text>
        </View>

        {/* CLIENT INFO CARD */}
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

        {/* MISSION DETAILS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
             <Ionicons name="construct" size={20} color="#D4AF37" />
             <Text style={styles.cardTitle}>SERVICE</Text>
          </View>
          <Text style={styles.serviceText}>{mission.serviceType}</Text>
          
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
          <TouchableOpacity onPress={openMap} style={styles.addressRow}>
            <Text style={styles.addressText}>{mission.address}</Text>
            <Ionicons name="open-outline" size={18} color="#D4AF37" />
          </TouchableOpacity>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionContainer}>
          {actionLoading ? (
            <ActivityIndicator size="large" color="#D4AF37" />
          ) : (
            <>
              {/* Button to START */}
              {(mission.status === 'ACCEPTED' || mission.status === 'PENDING') && (
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={() => updateStatus('IN_PROGRESS')}
                >
                  <Text style={styles.primaryButtonText}>Démarrer l'intervention</Text>
                  <Ionicons name="play" size={20} color="#0f172a" style={{marginLeft: 8}}/>
                </TouchableOpacity>
              )}

              {/* Button to FINISH */}
              {mission.status === 'IN_PROGRESS' && (
                <TouchableOpacity 
                  style={styles.successButton} 
                  onPress={() => updateStatus('COMPLETED')}
                >
                  <Text style={styles.successButtonText}>Marquer comme terminé</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginLeft: 8}}/>
                </TouchableOpacity>
              )}

              {/* Completed State */}
              {mission.status === 'COMPLETED' && (
                <View style={styles.completedBox}>
                  <Ionicons name="checkmark-done-circle" size={64} color="#10b981" />
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
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a' // Dark Blue Background
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#0f172a'
  },
  
  // --- HEADER ---
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

  // --- STATUS BANNER ---
  statusBanner: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 24,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    gap: 10
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusBannerText: { 
    fontWeight: 'bold', 
    fontSize: 14,
    letterSpacing: 1
  },

  // --- CARDS ---
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
  
  // Client Info
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

  // Service Details
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
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  addressText: { 
    fontSize: 16, 
    color: '#e2e8f0', 
    fontWeight: '500', 
    flex: 1,
    marginRight: 10
  },
  
  divider: { 
    height: 1, 
    backgroundColor: '#334155', 
    marginVertical: 16 
  },

  // --- ACTIONS ---
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