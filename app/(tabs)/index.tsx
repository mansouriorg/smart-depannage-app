import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
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

  // ✅ AUTO-REFRESH: Runs every time the screen becomes visible (focused)
  useFocusEffect(
    useCallback(() => {
      fetchMissions();
    }, [])
  );

  // --- 2. FUNCTION: Get GPS Position & Send to Backend ---
  const handleUpdatePosition = async () => {
    setLocationLoading(true);
    
    // 1. Ask Permission
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de votre position.');
      setLocationLoading(false);
      return;
    }

    try {
      // 2. Get Coordinates
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setStatus('online');

      // 3. Reverse Geocoding (Optional, for display)
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

      // 🚀 4. SEND TO BACKEND (This is the new part!)
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
      <Text style={styles.missionAddress}>📍 {mission.address}</Text>
      <Text style={styles.missionDate}>📅 {new Date(mission.createdAt).toLocaleDateString('fr-FR')}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          fetchMissions();
        }} />
      }
    >
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>Tech</Text>
        </View>
        <View>
          <Text style={styles.greeting}>Espace Technicien</Text>
          <Text style={styles.roleBadge}>Smart Dépannage</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: status === 'online' ? '#4CAF50' : '#ccc' }]} />
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
          style={[styles.bigButton, { backgroundColor: locationLoading ? '#ccc' : '#007AFF' }]} 
          onPress={handleUpdatePosition}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="location-outline" size={24} color="white" style={{ marginRight: 8 }} />
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
          <ActivityIndicator size="small" color="#007AFF" style={{ margin: 20 }} />
        ) : missions.length === 0 ? (
          <Text style={styles.emptyText}>Aucune mission assignée pour le moment.</Text>
        ) : (
          <View>
             {missions.map(renderMissionCard)}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

// ----------------------------------------------------------------------
// 4. STATUS BADGE COMPONENT
// ----------------------------------------------------------------------
const StatusBadge = ({ status }: { status: string }) => {
  let color = '#64748b'; // Grey
  let text = status;

  if (status === 'PENDING') { color = '#f59e0b'; text = 'En Attente'; } // Orange
  if (status === 'ACCEPTED') { color = '#3b82f6'; text = 'Accepté'; } // Blue
  if (status === 'IN_PROGRESS') { color = '#8b5cf6'; text = 'En Cours'; } // Violet
  if (status === 'COMPLETED') { color = '#10b981'; text = 'Terminé'; } // Green

  return (
    <View style={[styles.statusBadge, { backgroundColor: color }]}>
      <Text style={styles.statusBadgeText}>{text}</Text>
    </View>
  );
};

// ----------------------------------------------------------------------
// 5. STYLES
// ----------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  roleBadge: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  locationBox: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  locationText: {
    fontSize: 12,
    color: '#007AFF',
  },
  addressText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  bigButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  missionItem: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  missionTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1e293b',
  },
  clientName: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 2,
  },
  missionAddress: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  missionDate: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});