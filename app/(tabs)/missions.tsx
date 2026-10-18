import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ IMPORT REAL API
import api from '../../services/api';
// 🧩 Types and words shared with the server and the other apps (P1-09)
import { callApi, routes, serviceNameOf, type ArtisanIntervention } from '@/lib/shared';
import { StatusBadge, displayStatus } from '@/components/StatusBadge';

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
  const [filterStatus, setFilterStatus] = useState('ALL'); 
  const [missions, setMissions] = useState<ArtisanIntervention[]>([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- 1. Fetch Real Missions ---
  const fetchMissions = async () => {
    try {
      // The answer is typed by the server's own list of what an artisan may read: a field it no longer sends does not compile.
      setMissions(await callApi((config) => api.request(config), routes.interventions.assigned()));
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

  // --- 2. Filter Logic ---
  const filteredMissions = missions.filter(mission => {
    const query = searchQuery.toLowerCase();
    const title = serviceNameOf(mission.serviceType).toLowerCase();
    const address = (mission.address || '').toLowerCase();
    const matchesSearch = title.includes(query) || address.includes(query);
    const matchesStatus = filterStatus === 'ALL' || displayStatus(mission.status) === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // --- 3. Render Item ---
  const renderMissionItem = ({ item }: { item: ArtisanIntervention }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => router.push(`/mission/${item.id}`)}
    >
      {/* Header: Service Type & Badge */}
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{serviceNameOf(item.serviceType)}</Text>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.divider} />

      {/* Details */}
      <View style={styles.detailsContainer}>
        {/* Client */}
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#94a3b8" style={{ width: 20 }} />
          <Text style={styles.detailText}>
             {item.client?.name || "Client Inconnu"}
          </Text>
        </View>

        {/* Address */}
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#94a3b8" style={{ width: 20 }} />
          <Text style={styles.detailText} numberOfLines={1}>{item.address}</Text>
        </View>

        {/* Date */}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#94a3b8" style={{ width: 20 }} />
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString('fr-FR', { 
              weekday: 'short', day: 'numeric', month: 'short' 
            })}
          </Text>
        </View>
      </View>

      {/* Footer Arrow */}
      <View style={styles.cardFooter}>
         <Text style={styles.viewDetailsText}>Voir détails</Text>
         <Ionicons name="arrow-forward" size={16} color="#D4AF37" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Fixed Header Section */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Mes Missions</Text>
        
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput 
            placeholder="Rechercher une mission..." 
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {/* Filter Chips */}
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

      {/* Mission List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      ) : (
        <FlatList 
          data={filteredMissions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMissionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => {
                setRefreshing(true);
                fetchMissions();
              }} 
              tintColor="#D4AF37"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="clipboard-outline" size={40} color="#64748b" />
              </View>
              <Text style={styles.emptyTitle}>Aucune mission</Text>
              <Text style={styles.emptyText}>Aucun résultat ne correspond à votre recherche.</Text>
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
    backgroundColor: '#0f172a', // Dark Blue Background
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // --- HEADER SECTION ---
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 20,
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  
  // --- FILTERS ---
  filterContainer: {
    paddingLeft: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeChip: {
    backgroundColor: '#D4AF37', // Gold
    borderColor: '#D4AF37',
  },
  chipText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeChipText: {
    color: '#0f172a', // Dark text on Gold
    fontWeight: 'bold',
  },

  // --- LIST ---
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  
  // --- CARD STYLES ---
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 12,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#cbd5e1', // Off white
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  
  // --- CARD FOOTER ---
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

  // --- BADGE ---

  // --- EMPTY STATE ---
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
