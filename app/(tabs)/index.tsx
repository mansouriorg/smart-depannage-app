import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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

import { apiErrorMessage } from '../../services/api';
import { call } from '../../services/call';
import { positionNotice, sendPosition, switchAvailability, type AvailabilityDeps } from '../../services/availability';
import { coordinatesOnFile, coordinatesText, firstNameOf, initialsOf, shortDate, verificationNotice } from '../../services/display';
import { useI18n } from '../../services/i18n';
import { joinList, mirrorStyle, spacing } from '../../services/i18n-core';
import { AvailabilityCard } from '@/components/AvailabilityCard';
import { StatusBadge } from '@/components/StatusBadge';
import {
  availabilityView,
  missionBucketOf,
  routes,
  serviceName,
  slimProfile,
  type ArtisanIntervention,
  type ArtisanSelf,
} from '@/lib/shared';

/** Missions to accept first, then the ones under way, then the finished ones; the newest first inside each. */
const PILE_ORDER = { todo: 0, active: 1, done: 2 } as const;

function inOrder(missions: ArtisanIntervention[]): ArtisanIntervention[] {
  const rank = (mission: ArtisanIntervention) => {
    const pile = missionBucketOf(mission.status);

    return pile ? PILE_ORDER[pile] : 3;
  };

  return [...missions].sort((a, b) => rank(a) - rank(b) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

// ----------------------------------------------------------------------
// 1. MAIN COMPONENT
// ----------------------------------------------------------------------
export default function WorkerDashboard() {
  const router = useRouter();
  const { t, locale, isRtl } = useI18n();

  // Who the artisan is and whether they are online: what the server says (P1-15), not a guess of the phone.
  const [self, setSelf] = useState<ArtisanSelf | null>(null);
  const [selfFailed, setSelfFailed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [positionLoading, setPositionLoading] = useState(false);
  const [where, setWhere] = useState<string | null>(null);

  // Mission States
  const [missions, setMissions] = useState<ArtisanIntervention[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // One change of availability or position at a time, even if the finger is quicker than the screen.
  const working = useRef(false);

  // Counts the answers of the switch: a profile fetched before the switch was answered says what was true before it,
  // and is not allowed to put the old state back on screen.
  const profileEpoch = useRef(0);

  // The point the phone read last, kept until the server has taken it: only a position the server has is shown.
  const lastRead = useRef<{ latitude: number; longitude: number } | null>(null);

  const view = self ? availabilityView(self) : null;

  // --- 1. FUNCTION: Fetch the artisan and the missions ---
  const load = async () => {
    const epoch = profileEpoch.current;
    const [mine, list] = await Promise.allSettled([call(routes.artisans.profile()), call(routes.interventions.assigned())]);

    if (mine.status === 'fulfilled') {
      // Only what the screens show is kept: the bank details and the documents of the answer are dropped.
      if (epoch === profileEpoch.current) setSelf(slimProfile(mine.value));
      setSelfFailed(false);
    } else {
      console.error("Error fetching the artisan:", mine.reason);
      setSelfFailed(true);
    }

    if (list.status === 'fulfilled') {
      setMissions(list.value);
    } else {
      console.error("Error fetching missions:", list.reason);
    }

    setMissionsLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  // --- 2. FUNCTIONS: the position, and the switch ---
  const deps: AvailabilityDeps = {
    call,
    readPosition: async () => {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') return 'denied';

      const here = await Location.getCurrentPositionAsync({});
      const point = { latitude: here.coords.latitude, longitude: here.coords.longitude };

      lastRead.current = point;

      return point;
    },
  };

  // Shows the position the server has just taken: the coordinates at once, then the address when the phone finds it
  // (a courtesy; without it the coordinates stay).
  const showPlace = async (point: { latitude: number; longitude: number }) => {
    setWhere(coordinatesText(point));

    try {
      const found = await Location.reverseGeocodeAsync(point);
      const place = found[0];
      const label = place ? joinList([place.street || place.name, place.city || place.subregion], locale) : '';

      if (label) setWhere(label);
    } catch {
      // keep the coordinates
    }
  };

  const toggleAvailability = async () => {
    if (working.current || !view) return;

    working.current = true;
    setSwitching(true);

    try {
      // "Busy" is the server's word; from there the switch means going offline too.
      const { answer, position } = await switchAvailability(view === 'offline' ? 'online' : 'offline', deps);

      profileEpoch.current += 1;
      setSelf((current) => (current ? { ...current, ...answer } : current));

      if (answer.availabilityStatus === 'OFFLINE') setWhere(null);
      else if (position === 'sent' && lastRead.current) void showPlace(lastRead.current);

      const notice = positionNotice(position, locale);

      if (notice) Alert.alert(t('app.home.positionTitle'), notice);
    } catch (error) {
      Alert.alert(t('common.states.error'), apiErrorMessage(error, t('app.home.availabilityFailed')));
    } finally {
      working.current = false;
      setSwitching(false);
    }
  };

  const refreshPosition = async () => {
    if (working.current) return;

    working.current = true;
    setPositionLoading(true);

    try {
      const outcome = await sendPosition(deps);

      if (outcome === 'sent') {
        if (lastRead.current) void showPlace(lastRead.current);
        Alert.alert(t('app.home.positionTitle'), t('app.home.positionUpdated'));
      } else Alert.alert(t('app.home.positionTitle'), positionNotice(outcome, locale) ?? t('app.home.positionNotUpdated'));
    } finally {
      working.current = false;
      setPositionLoading(false);
    }
  };

  // --- 3. RENDER MISSION CARD ---
  const renderMissionCard = (mission: ArtisanIntervention) => (
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
          <Text style={styles.missionTitle}>{serviceName(mission.serviceType, locale)}</Text>
        </View>
        <StatusBadge status={mission.status} paddingVertical={5} />
      </View>
      
      <View style={styles.divider} />

      {/* Details */}
      <View style={styles.missionDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#94a3b8" style={styles.detailIcon} />
          <Text style={styles.clientName}>{mission.client?.name || t('app.common.unknownClient')}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#94a3b8" style={styles.detailIcon} />
          <Text style={styles.missionAddress} numberOfLines={1}>{mission.address}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#94a3b8" style={styles.detailIcon} />
          <Text style={[styles.missionDate, isRtl && styles.upright]}>{shortDate(mission.createdAt, locale)}</Text>
        </View>
      </View>

      {/* Action Arrow */}
      <View style={styles.cardFooter}>
         <Text style={styles.viewDetailsText}>{t('app.common.viewDetails')}</Text>
         <Ionicons name="arrow-forward" size={16} color="#D4AF37" style={mirrorStyle(locale)} />
      </View>
    </TouchableOpacity>
  );

  const notice = self ? verificationNotice(self.verificationStatus, locale) : null;
  const name = self?.user.name;
  // The last position the server holds, until the artisan sends a new one from this screen.
  const placeOnFile = self ? coordinatesOnFile(self.user.latitude, self.user.longitude) : null;

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
              load();
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
                <Text style={styles.avatarText}>{initialsOf(name)}</Text>
              </View>
              {/* Online Indicator Badge */}
              <View style={[styles.onlineBadge, { backgroundColor: view === 'online' ? '#10b981' : view === 'busy' ? '#f59e0b' : '#64748b' }]} />
            </View>
            <View>
              <Text style={styles.greeting}>{t('app.home.greeting')}</Text>
              <Text style={[styles.roleBadge, { letterSpacing: spacing(locale, 0.5) }]}>{firstNameOf(name) ?? t('app.common.technician')}</Text>
            </View>
          </View>
        </View>

        {notice ? (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle" size={20} color="#f59e0b" />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {/* CARD 1: AVAILABILITY AND POSITION */}
        <AvailabilityCard
          view={view}
          failed={selfFailed && !self}
          busy={switching}
          onToggle={toggleAvailability}
          onRefreshPosition={refreshPosition}
          refreshing={positionLoading}
          where={where ?? placeOnFile}
        />

        {/* SECTION TITLE */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('app.home.assignedMissions')}</Text>
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
              <Text style={styles.emptyTitle}>{t('app.common.noMission')}</Text>
              <Text style={styles.emptyText}>{t('app.home.noAssigned')}</Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
               {inOrder(missions).map(renderMissionCard)}
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
    marginEnd: 16,
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
    end: -2,
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
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    color: '#fcd34d',
    fontSize: 14,
    lineHeight: 20,
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
  // Arabic has no italic: a slanted Arabic text looks broken.
  upright: {
    fontStyle: 'normal',
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
