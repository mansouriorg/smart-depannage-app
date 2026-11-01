import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import { callApi, missionBucketOf, missionBuckets, routes, serviceName, type ArtisanIntervention } from '@/lib/shared';
import { OfflineBanner, PendingBadge } from '@/components/OfflineBanner';
import { onQueueSettled } from '../../services/offline';
import { StatusBadge } from '@/components/StatusBadge';
import { shortDate } from '../../services/display';
import { useI18n } from '../../services/i18n';
import { mirrorStyle } from '../../services/i18n-core';

export default function MissionsScreen() {
  const router = useRouter();
  const { t, locale, isRtl } = useI18n();

  // 🏷️ FILTER OPTIONS: the piles the shared package sorts a mission in (to accept, under way, over), whatever
  // spelling or step the status is in. The list used to know four spellings, so a mission that was on the way
  // or had arrived matched no filter.
  const FILTERS = [{ id: 'ALL', label: t('app.missions.all') }, ...missionBuckets(locale)];
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); 
  const [missions, setMissions] = useState<ArtisanIntervention[]>([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // The number of the read whose list is now drawn: an answer asked for before it (a slow network, and a reload because an action left the phone
  // in between) is old, and would bring back a job as it was. (A count, not the time: a phone clock corrected backwards would drop every read.)
  const askedReads = useRef(0);
  const appliedRead = useRef(0);

  // --- 1. Fetch Real Missions ---
  const fetchMissions = async () => {
    const asked = (askedReads.current += 1);

    try {
      // The answer is typed by the server's own list of what an artisan may read: a field it no longer sends does not compile.
      const list = await callApi((config) => api.request(config), routes.interventions.assigned());

      if (asked >= appliedRead.current) {
        appliedRead.current = asked;
        setMissions(list);
      }
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

  // An action the phone kept has left: the list is read again (see the home screen).
  useEffect(() => onQueueSettled(() => void fetchMissions()), []);

  // --- 2. Filter Logic ---
  const filteredMissions = missions.filter(mission => {
    const query = searchQuery.toLowerCase();
    const title = serviceName(mission.serviceType, locale).toLowerCase();
    const address = (mission.address || '').toLowerCase();
    const matchesSearch = title.includes(query) || address.includes(query);
    const matchesStatus = filterStatus === 'ALL' || missionBucketOf(mission.status) === filterStatus;
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
        <Text style={styles.title}>{serviceName(item.serviceType, locale)}</Text>
        <StatusBadge status={item.status} />
      </View>
      <PendingBadge missionId={item.id} />

      <View style={styles.divider} />

      {/* Details */}
      <View style={styles.detailsContainer}>
        {/* Client */}
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#94a3b8" style={{ width: 20 }} />
          <Text style={styles.detailText}>
             {item.client?.name || t('app.common.unknownClient')}
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
          <Text style={[styles.dateText, isRtl && styles.upright]}>{shortDate(item.createdAt, locale)}</Text>
        </View>
      </View>

      {/* Footer Arrow */}
      <View style={styles.cardFooter}>
         <Text style={styles.viewDetailsText}>{t('app.common.viewDetails')}</Text>
         <Ionicons name="arrow-forward" size={16} color="#D4AF37" style={mirrorStyle(locale)} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Fixed Header Section */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('app.missions.title')}</Text>
        
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" style={{ marginEnd: 8 }} />
          <TextInput 
            placeholder={t('app.missions.search')} 
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterContainer}>
          {/* A few short chips: they wrap onto a second line on a narrow screen. A scroll view would start at its left end while the row starts
              on the right (Arabic before the system has been restarted), and the chips on the far side could not be reached. */}
          <View style={styles.filterRow}>
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
          </View>
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
          // What the phone keeps until it has a signal (P3-06): at the top of the list, so that it scrolls away and never takes the list's room.
          ListHeaderComponent={<OfflineBanner flush />}
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
              <Text style={styles.emptyTitle}>{t('app.common.noMission')}</Text>
              <Text style={styles.emptyText}>{t('app.missions.noResults')}</Text>
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
    paddingStart: 20,
    paddingEnd: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginEnd: 8,
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
  // Arabic has no italic: a slanted Arabic text looks broken.
  upright: {
    fontStyle: 'normal',
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
