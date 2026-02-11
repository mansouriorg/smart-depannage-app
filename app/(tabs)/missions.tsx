import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ IMPORT REAL API
import api from '../../services/api';

// 🏷️ FILTER OPTIONS
const FILTERS = [
  { id: 'ALL', label: 'Tout' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'ACCEPTED', label: 'Accepté' },
  { id: 'IN_PROGRESS', label: 'En cours' },
  { id: 'COMPLETED', label: 'Terminé' },
];

export default function MissionsScreen() {
  const router = useRouter();
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 🆕 Filter State
  const [missions, setMissions] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- 1. Fetch Real Missions ---
  const fetchMissions = async () => {
    try {
      const response = await api.get('/interventions/assigned');
      setMissions(response.data);
    } catch (error) {
      console.error("Error fetching missions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
    }, [])
  );

  // --- 2. Filter Logic (Search + Status) ---
  const filteredMissions = missions.filter(mission => {
    // A. Text Search
    const query = searchQuery.toLowerCase();
    const title = (mission.serviceType || '').toLowerCase();
    const address = (mission.address || '').toLowerCase();
    const matchesSearch = title.includes(query) || address.includes(query);

    // B. Status Filter
    const matchesStatus = filterStatus === 'ALL' || mission.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // --- 3. Helper: Status Colors ---
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return '#FF9500'; 
      case 'ACCEPTED': return '#007AFF'; 
      case 'IN_PROGRESS': return '#8b5cf6'; 
      case 'COMPLETED': return '#34C759'; 
      case 'CANCELED': return '#FF3B30'; 
      default: return '#8E8E93';
    }
  };

  // --- 4. Render Item ---
  const renderMissionItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/mission/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.title}>{item.serviceType}</Text>
      
      <View style={styles.locationRow}>
        <Ionicons name="location-sharp" size={16} color="#666" />
        <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.tapText}>
           {item.client?.name ? `Client: ${item.client.name}` : 'Voir les détails'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header Container */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Mes Missions</Text>
        
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 8 }} />
          <TextInput 
            placeholder="Rechercher..." 
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {/* 🆕 FILTER CHIPS (Horizontal Scroll) */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
            {FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setFilterStatus(filter.id)}
                style={[
                  styles.filterChip,
                  filterStatus === filter.id && styles.activeChip
                ]}
              >
                <Text style={[
                  styles.chipText,
                  filterStatus === filter.id && styles.activeChipText
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList 
          data={filteredMissions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMissionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              fetchMissions();
            }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucune mission trouvée.</Text>
            </View>
          }
        />
      )}
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
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  // 🆕 Filter Styles
  filterContainer: {
    paddingLeft: 16,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  activeChip: {
    backgroundColor: '#007AFF', // Blue when selected
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  activeChipText: {
    color: 'white', // White text when selected
  },
  // List Styles
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
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
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
    flex: 1,
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
    fontWeight: '500',
  },
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 10,
  },
});