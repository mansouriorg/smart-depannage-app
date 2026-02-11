import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

  // ✅ AUTO-REFRESH
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

      Alert.alert("Succès", "Position mise à jour et envoyée au serveur !");
    } catch (error) {
      console.error("Location Error:", error);
      Alert.alert("Erreur", "Impossible de mettre à jour la localisation sur le serveur.");
    } finally {
      setLocationLoading(false);
    }
  };

  // --- 3. RENDER MISSION CARD ---
  const renderMissionCard = (mission: any) => (
    <TouchableOpacity 
      key={mission.id}
      style={styles.missionItem}
      onPress={() => router.push(`/mission/${mission.id}`)} 
    >
      <View style={styles.missionHeader}>
        <Text style={styles.missionTitle}>{mission.serviceType}</Text>
        <StatusBadge status={mission.status} />
      </View>
      
      <Text style={styles.clientName}>👤 {mission.client?.name || "Client"}</Text>
      
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={14} color="#94a3b8" />
        <Text style={styles.missionAddress}>{mission.address}</Text>
      </View>
      
      <Text style={styles.missionDate}>📅 {new Date(mission.createdAt).toLocaleDateString('fr-FR')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              fetchMissions();
            }} 
            tintColor="#D4AF37" // Gold spinner
          />
        }
      >
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>SD</Text>
            </View>
            <View>
              <Text style={styles.greeting}>Espace Technicien</Text>
              <Text style={styles.roleBadge}>Smart Dépannage</Text>
            </View>
          </View>
          <View style={[styles.statusDot, { backgroundColor: status === 'online' ? '#4CAF50' : '#64748b' }]} />
        </View>

        {/* CARD 1: GPS STATUS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Mon Statut</Text>
          <Text style={styles.cardSubtitle}>
            {status === 'online' 
              ? "Vous êtes EN LIGNE et visible." 
              : "Signalez votre présence pour recevoir des missions."}
          </Text>

          {location && (
            <View style={styles.locationBox}>
              {address ? (
                <Text style={styles.addressText}>📌 {address}</Text>
              ) : (
                <Text style={styles.locationText}>
                  Lat: {location.coords.latitude.toFixed(4)}, Long: {location.coords.longitude.toFixed(4)}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity 
            style={[styles.bigButton, { backgroundColor: locationLoading ? '#64748b' : '#D4AF37' }]} 
            onPress={handleUpdatePosition}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <Ionicons name="location" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {location ? "Actualiser ma position" : "Signaler ma présence"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* CARD 2: MISSION LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>📋 Mes Missions</Text>
            {missions.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{missions.length}</Text>
              </View>
            )}
          </View>
          
          {missionsLoading ? (
            <ActivityIndicator size="small" color="#D4AF37" style={{ margin: 20 }} />
          ) : missions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#334155" />
              <Text style={styles.emptyText}>Aucune mission assignée.</Text>
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

// ----------------------------------------------------------------------
// 4. STATUS BADGE COMPONENT
// ----------------------------------------------------------------------
const StatusBadge = ({ status }: { status: string }) => {
  let color = '#334155'; // Dark Grey Default
  let text = status;
  let textColor = '#cbd5e1';

  if (status === 'PENDING') { color = '#f59e0b'; text = 'En Attente'; textColor='#fff'; } // Orange
  if (status === 'ACCEPTED') { color = '#0f172a'; text = 'Accepté'; textColor='#D4AF37'; } // Dark Blue with Gold text
  if (status === 'IN_PROGRESS') { color = '#D4AF37'; text = 'En Cours'; textColor='#0f172a'; } // Gold with Dark text
  if (status === 'COMPLETED') { color = '#10b981'; text = 'Terminé'; textColor='#fff'; } // Green

  return (
    <View style={[styles.statusBadge, { backgroundColor: color, borderColor: color === '#0f172a' ? '#D4AF37' : 'transparent', borderWidth: 1 }]}>
      <Text style={[styles.statusBadgeText, { color: textColor }]}>{text}</Text>
    </View>
  );
};

// ----------------------------------------------------------------------
// 5. STYLES (Dark Blue & Gold Theme)
// ----------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Background Blue
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#D4AF37', // Gold Avatar
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF', // White text
  },
  roleBadge: {
    fontSize: 14,
    color: '#94a3b8', // Light Grey
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  card: {
    backgroundColor: '#1e293b', // Darker Card Background
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155', // Subtle Border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#D4AF37', // Gold Title
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 20,
  },
  locationBox: {
    backgroundColor: '#0f172a', // Darkest Blue
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationText: {
    fontSize: 12,
    color: '#D4AF37',
  },
  addressText: {
    fontSize: 14,
    color: '#e2e8f0', // Off-white
    fontWeight: '600',
  },
  bigButton: {
    backgroundColor: '#D4AF37', // Gold Button
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#0f172a', // Dark Text on Gold
    fontSize: 16,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  // Mission Item Styles
  missionItem: {
    backgroundColor: '#0f172a', // Deep Blue inside card
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  missionTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#FFFFFF',
  },
  clientName: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  missionAddress: {
    fontSize: 13,
    color: '#cbd5e1',
    marginLeft: 4,
  },
  missionDate: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});