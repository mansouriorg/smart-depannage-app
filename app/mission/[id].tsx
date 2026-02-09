import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MOCK_MISSIONS } from '../../services/mockData';

export default function MissionDetailScreen() {
  const router = useRouter();
  
  // 1. Get the ID from the URL (e.g., mission/1)
  const { id } = useLocalSearchParams();

  // 2. Find the mission in our fake DB
  const initialMission = MOCK_MISSIONS.find((m) => m.id === id);

  // If mission not found (error handling)
  if (!initialMission) {
    return (
      <View style={styles.centerContainer}>
        <Text>Mission not found!</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Local state to simulate status updates
  const [status, setStatus] = useState(initialMission.status);

  // --- ACTIONS ---
  const handleStartMission = () => {
    Alert.alert("Start Mission", "Are you at the location and ready to start?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Yes, Start", 
        onPress: () => {
          setStatus('in_progress');
          // TODO: API.updateMissionStatus(id, 'in_progress')
        } 
      }
    ]);
  };

  const handleFinishMission = () => {
    Alert.alert("Complete Mission", "Have you finished all the work?", [
      { text: "No", style: "cancel" },
      { 
        text: "Yes, Complete", 
        onPress: () => {
          setStatus('done');
          // TODO: API.updateMissionStatus(id, 'done')
          router.back(); // Go back to list after finishing
        } 
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* CUSTOM HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mission Details</Text>
        <View style={{ width: 24 }} /> {/* Spacer for alignment */}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* STATUS BANNER */}
        <View style={[styles.statusBanner, { backgroundColor: status === 'done' ? '#34C759' : '#007AFF' }]}>
          <Text style={styles.statusBannerText}>Current Status: {status.toUpperCase().replace('_', ' ')}</Text>
        </View>

        {/* INFO CARDS */}
        <View style={styles.card}>
          <Text style={styles.label}>TASK</Text>
          <Text style={styles.title}>{initialMission.title}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.label}>DESCRIPTION</Text>
          <Text style={styles.body}>{initialMission.description}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>LOCATION</Text>
          <View style={styles.row}>
            <Ionicons name="location" size={20} color="#007AFF" />
            <Text style={styles.address}>{initialMission.address}</Text>
          </View>
          
          {/* Map Placeholder Button */}
          <TouchableOpacity style={styles.mapButton} onPress={() => Alert.alert("Map", "Open Google Maps/Waze here")}>
            <Text style={styles.mapButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.actionContainer}>
          {status === 'pending' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartMission}>
              <Text style={styles.primaryButtonText}>Start Mission</Text>
            </TouchableOpacity>
          )}

          {status === 'in_progress' && (
            <TouchableOpacity style={styles.successButton} onPress={handleFinishMission}>
              <Text style={styles.primaryButtonText}>Mark as Completed</Text>
            </TouchableOpacity>
          )}

          {status === 'done' && (
            <View style={styles.completedBox}>
              <Ionicons name="checkmark-circle" size={48} color="#34C759" />
              <Text style={styles.completedText}>Mission Completed</Text>
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
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60, // Safe area
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBannerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#3A3A3C',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  mapButton: {
    marginTop: 16,
    backgroundColor: '#E5F1FF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mapButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  actionContainer: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#34C759',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completedBox: {
    alignItems: 'center',
    padding: 20,
  },
  completedText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34C759',
  },
  linkText: {
    color: '#007AFF',
    marginTop: 10,
    fontSize: 16,
  },
});