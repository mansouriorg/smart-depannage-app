import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MOCK_MISSIONS } from '../../services/mockData';

export default function MissionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const initialMission = MOCK_MISSIONS.find((m) => m.id === id);

  if (!initialMission) {
    return (
      <View style={styles.centerContainer}>
        <Text>Mission introuvable !</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [status, setStatus] = useState(initialMission.status);

  const getStatusLabel = (s: string) => {
    switch(s) {
      case 'pending': return 'EN ATTENTE';
      case 'in_progress': return 'EN COURS';
      case 'done': return 'TERMINÉ';
      default: return s.toUpperCase();
    }
  };

  const handleStartMission = () => {
    Alert.alert("Commencer la mission", "Êtes-vous sur place et prêt à commencer ?", [
      { text: "Annuler", style: "cancel" },
      { 
        text: "Oui, Commencer", 
        onPress: () => {
          setStatus('in_progress');
        } 
      }
    ]);
  };

  const handleFinishMission = () => {
    Alert.alert("Terminer la mission", "Avez-vous terminé tout le travail ?", [
      { text: "Non", style: "cancel" },
      { 
        text: "Oui, Terminer", 
        onPress: () => {
          setStatus('done');
          router.back();
        } 
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la Mission</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={[styles.statusBanner, { backgroundColor: status === 'done' ? '#34C759' : '#007AFF' }]}>
          <Text style={styles.statusBannerText}>Statut : {getStatusLabel(status)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>TÂCHE</Text>
          <Text style={styles.title}>{initialMission.title}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.label}>DESCRIPTION</Text>
          <Text style={styles.body}>{initialMission.description}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>ADRESSE</Text>
          <View style={styles.row}>
            <Ionicons name="location" size={20} color="#007AFF" />
            <Text style={styles.address}>{initialMission.address}</Text>
          </View>
          
          <TouchableOpacity style={styles.mapButton} onPress={() => Alert.alert("Carte", "Ouverture de Google Maps/Waze...")}>
            <Text style={styles.mapButtonText}>Ouvrir la carte</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionContainer}>
          {status === 'pending' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartMission}>
              <Text style={styles.primaryButtonText}>Démarrer la mission</Text>
            </TouchableOpacity>
          )}

          {status === 'in_progress' && (
            <TouchableOpacity style={styles.successButton} onPress={handleFinishMission}>
              <Text style={styles.primaryButtonText}>Marquer comme terminé</Text>
            </TouchableOpacity>
          )}

          {status === 'done' && (
            <View style={styles.completedBox}>
              <Ionicons name="checkmark-circle" size={48} color="#34C759" />
              <Text style={styles.completedText}>Mission Terminée</Text>
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
    paddingTop: 60,
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