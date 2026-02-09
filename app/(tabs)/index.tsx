import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ----------------------------------------------------------------------
// 1. MOCK DATA (Ideally this comes from services/mockData.ts later)
// ----------------------------------------------------------------------
const WORKER_PROFILE = {
  name: "Mahmoud",
  role: "Plombier",
  avatarInitials: "MM",
};

const PENDING_MISSIONS = 2; // Example count

// ----------------------------------------------------------------------
// 2. MAIN COMPONENT
// ----------------------------------------------------------------------
export default function WorkerDashboard() {
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'online' | 'offline'>('offline');
  const [address, setAddress] = useState<string | null>(null);

  // --- FUNCTION: Get GPS Location ---
  const handleUpdatePosition = async () => {
    setLoading(true);
    
    // 1. Request Permission
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'We need your location to assign missions.');
      setLoading(false);
      return;
    }

    // 2. Get Coordinates
    try {
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setStatus('online');

      // (Optional) Reverse Geocode to get street name
      let addressResponse = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      if (addressResponse.length > 0) {
        const addr = addressResponse[0];
        setAddress(`${addr.street}, ${addr.city}`);
      }

      // TODO: Here you would call API.updateLocation(lat, long)
      Alert.alert("Success", "Position updated! You are now visible to supervisors.");
      
    } catch (error) {
      Alert.alert("Error", "Could not fetch location.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{WORKER_PROFILE.avatarInitials}</Text>
        </View>
        <View>
          <Text style={styles.greeting}>Hello, {WORKER_PROFILE.name}</Text>
          <Text style={styles.roleBadge}>{WORKER_PROFILE.role}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: status === 'online' ? '#4CAF50' : '#ccc' }]} />
      </View>

      {/* ACTION CARD: UPDATE POSITION */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 My Status</Text>
        <Text style={styles.cardSubtitle}>
          {status === 'online' 
            ? "You are ONLINE and visible." 
            : "You are OFFLINE. Update position to start."}
        </Text>

        {location && (
          <View style={styles.locationBox}>
            <Text style={styles.locationText}>
              Lat: {location.coords.latitude.toFixed(4)}, Long: {location.coords.longitude.toFixed(4)}
            </Text>
            {address && <Text style={styles.addressText}>{address}</Text>}
          </View>
        )}

        <TouchableOpacity 
          style={[styles.bigButton, { backgroundColor: loading ? '#ccc' : '#007AFF' }]} 
          onPress={handleUpdatePosition}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="location-outline" size={24} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>
                {location ? "Update My Position" : "Check In Now"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* SUMMARY CARD: MISSIONS */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>📋 Active Missions</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{PENDING_MISSIONS} New</Text>
          </View>
        </View>
        
        <Text style={styles.cardSubtitle}>You have {PENDING_MISSIONS} pending jobs nearby.</Text>
        
        <TouchableOpacity 
          style={styles.outlineButton}
          onPress={() => router.push('/(tabs)/missions')}
        >
          <Text style={styles.outlineButtonText}>View All Missions</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

// ----------------------------------------------------------------------
// 3. STYLES
// ----------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS Light Gray
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60, // Safe area top
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
    fontSize: 18,
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
    marginLeft: 'auto', // Pushes it to the right
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
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  locationBox: {
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  addressText: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
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
  outlineButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});