import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ IMPORT API
import api from '../../services/api';
import { StatusBadge } from '@/components/StatusBadge';
import { serviceNameOf } from '@/lib/shared';

// ----------------------------------------------------------------------
// 1. MAIN COMPONENT
// ----------------------------------------------------------------------
export default function WorkerDashboard() {
  const router = useRouter();
  
  // Location States
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [status, setStatus] = useState<'online' | 'offline'>('offline');

  // Mission States
  const [missions, setMissions] = useState<any[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- 1. FUNCTION: Fetch Missions ---
  const fetchMissions = async () => {
    try {
      const response = await api.get('/interventions/assigned');
      setMissions(response.data);
    } catch (error) {
      console.error("Error fetching missions:", error);
    } finally {
      setMissionsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
    }, [])
  );

  // --- 2. FUNCTION: Get GPS Position ---
  const handleUpdatePosition = async () => {
    setLocationLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de votre position.');
      setLocationLoading(false);
      return;
    }

    try {
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setStatus('online');

      let addressResponse = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      if (addressResponse.length > 0) {
        const addr = addressResponse[0];
        const street = addr.street || addr.name || '';
        const city = addr.city || addr.subregion || '';
        setAddress(`${street}, ${city}`);
      }

      console.log("Sending location to backend...");
      await api.patch('/users/location', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      Alert.alert("Succès", "Position mise à jour !");
    } catch (error) {
      console.error("Location Error:", error);
      Alert.alert("Erreur", "Impossible de mettre à jour la localisation.");
    } finally {
      setLocationLoading(false);
    }
  };

  // --- 3. RENDER MISSION CARD ---
  const renderMissionCard = (mission: any) => (
    <TouchableOpacity 
      key={mission.id}
      style={styles.missionItem}
      activeOpacity={0.7}
      onPress={() => router.push(`/mission/${mission.id}`)} 
    >
      {/* Header: Type & Status */}
      <View style={styles.missionHeader}>
        <View style={styles.missionTitleRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="construct" size={16} color="#D4AF37" />
          </View>
          <Text style={styles.missionTitle}>{serviceNameOf(mission.serviceType)}</Text>
        </View>
        <StatusBadge status={mission.status} paddingVertical={5} />
      </View>
      
      <View style={styles.divider} />

      {/* Details */}
      <View style={styles.missionDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#94a3b8" style={styles.detailIcon} />
          <Text style={styles.clientName}>{mission.client?.name || "Client Inconnu"}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#94a3b8" style={styles.detailIcon} />
          <Text style={styles.missionAddress} numberOfLines={1}>{mission.address}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#94a3b8" style={styles.detailIcon} />
          <Text style={styles.missionDate}>
            {new Date(mission.createdAt).toLocaleDateString('fr-FR', { 
              weekday: 'short', day: 'numeric', month: 'short' 
            })}
          </Text>
        </View>
      </View>

      {/* Action Arrow */}
      <View style={styles.cardFooter}>
         <Text style={styles.viewDetailsText}>Voir détails</Text>
         <Ionicons name="arrow-forward" size={16} color="#D4AF37" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              fetchMissions();
            }} 
            tintColor="#D4AF37" 
            colors={["#D4AF37"]}
          />
        }
      >
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>SD</Text>
              </View>
              {/* Online Indicator Badge */}
              <View style={[styles.onlineBadge, { backgroundColor: status === 'online' ? '#10b981' : '#64748b' }]} />
            </View>
            <View>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.roleBadge}>Technicien Smart</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notifButton}>
             <Ionicons name="notifications-outline" size={24} color="#D4AF37" />
             <View style={styles.redDot} />
          </TouchableOpacity>
        </View>

        {/* CARD 1: GPS STATUS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="navigate-circle" size={24} color="#D4AF37" />
                <Text style={styles.cardTitle}>Ma Position</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: status === 'online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)' }]}>
                <Text style={[styles.statusPillText, { color: status === 'online' ? '#10b981' : '#94a3b8' }]}>
                    {status === 'online' ? '● EN LIGNE' : '○ HORS LIGNE'}
                </Text>
            </View>
          </View>

          <Text style={styles.cardSubtitle}>
            {status === 'online' 
              ? "Votre position est visible par les clients." 
              : "Activez votre GPS pour recevoir des missions."}
          </Text>

          {location && (
            <View style={styles.terminalBox}>
              <Text style={styles.terminalLabel}>CURRENT_LOCATION:</Text>
              {address ? (
                <Text style={styles.addressText}>📌 {address}</Text>
              ) : (
                <Text style={styles.locationText}>
                  LAT: {location.coords.latitude.toFixed(6)} | LNG: {location.coords.longitude.toFixed(6)}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity 
            style={[styles.bigButton, { opacity: locationLoading ? 0.7 : 1 }]} 
            onPress={handleUpdatePosition}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <Ionicons name={status === 'online' ? "refresh" : "power"} size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {status === 'online' ? "Actualiser ma position" : "Activer ma disponibilité"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION TITLE */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Missions Assignées</Text>
            {missions.length > 0 && <View style={styles.countBadge}><Text style={styles.countText}>{missions.length}</Text></View>}
        </View>

        {/* CARD 2: MISSION LIST */}
        <View style={styles.missionsContainer}>
          {missionsLoading ? (
            <ActivityIndicator size="large" color="#D4AF37" style={{ margin: 40 }} />
          ) : missions.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                 <Ionicons name="briefcase-outline" size={40} color="#64748b" />
              </View>
              <Text style={styles.emptyTitle}>Aucune mission</Text>
              <Text style={styles.emptyText}>Vous n'avez pas encore de mission assignée pour le moment.</Text>
            </View>
          ) : (
            <View>
               {missions.map(renderMissionCard)}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Main Dark Background
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  
  // --- HEADER ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatarText: {
    color: '#D4AF37',
    fontSize: 20,
    fontWeight: '900',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  greeting: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 2,
  },
  roleBadge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  redDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // --- CARD GENERIC ---
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 22,
  },
  
  // --- TERMINAL BOX ---
  terminalBox: {
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
  },
  terminalLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  locationText: {
    fontSize: 13,
    color: '#D4AF37',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addressText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },

  // --- BUTTONS ---
  bigButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },

  // --- MISSION LIST ---
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  countBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  missionsContainer: {
    gap: 16,
  },
  missionItem: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 16,
  },
  missionDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIcon: {
    width: 16,
  },
  clientName: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  missionAddress: {
    fontSize: 14,
    color: '#94a3b8',
    flex: 1,
  },
  missionDate: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // --- STATUS BADGE ---

  // --- EMPTY STATE ---
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
