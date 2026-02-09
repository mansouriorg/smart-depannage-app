import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MOCK_MISSIONS, Mission } from '../../services/mockData';

export default function MissionsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter missions based on search text
  const filteredMissions = MOCK_MISSIONS.filter(mission => 
    mission.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mission.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return '#FF9500'; // Orange
      case 'in_progress': return '#007AFF'; // Blue
      case 'done': return '#34C759'; // Green
      default: return '#8E8E93';
    }
  };

  const renderMissionItem = ({ item }: { item: Mission }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/mission/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.date}>{item.date}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase().replace('_', ' ')}</Text>
        </View>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      
      <View style={styles.locationRow}>
        <Ionicons name="location-sharp" size={16} color="#666" />
        <Text style={styles.address}>{item.address}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.tapText}>Tap to view details</Text>
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header / Search Bar */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>My Missions</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
          <TextInput 
            placeholder="Search address or task..." 
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* List */}
      <FlatList 
        data={filteredMissions}
        keyExtractor={(item) => item.id}
        renderItem={renderMissionItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No missions found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerContainer: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  address: {
    marginLeft: 4,
    color: '#3A3A3C',
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapText: {
    fontSize: 12,
    color: '#007AFF',
  },
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
  },
});