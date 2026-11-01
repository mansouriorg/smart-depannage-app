import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import api, { endSession, getRefreshToken } from '../../services/api';
import { call } from '../../services/call';
import { initialsOf, memberSince, ratingText, tradesText, verificationNotice } from '../../services/display';
import { useI18n } from '../../services/i18n';
import { joinList, mirrorStyle, spacing } from '../../services/i18n-core';
import { offlineQueue, syncOfflineUser } from '../../services/offline';
import { unregisterPush } from '../../services/push';
import { runBestEffort } from '../../services/sign-out';
import { beginSession, stopSharing } from '../../services/road-state';
import { LanguageSelector } from '@/components/LanguageSelector';
import { isolateFor, routes, slimProfile, type ArtisanSelf } from '@/lib/shared';

const APP_VERSION = '1.0.0';

export default function ProfileScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const chevron = mirrorStyle(locale);

  // The real artisan (P1-15): what the server says about the signed-in account, not placeholder text.
  const [artisan, setArtisan] = useState<ArtisanSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);

    try {
      // Only what this screen shows is kept: the bank details and the documents of the answer are dropped.
      setArtisan(slimProfile(await call(routes.artisans.profile())));
    } catch (error) {
      console.error("Error fetching the profile:", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleLogout = async () => {
    if (signingOut) return;

    setSigningOut(true);

    // The home screen is alive behind this one until the session is cleared: its position stops going out now, not when the screen is gone.
    stopSharing();

    try {
      // 1. While the session still works: no more pushes to this phone for this artisan, and offline, so that
      //    no mission is given to someone who will not hear about it. Best effort and quick (both at once, and
      //    cancelled when the time is up): a missing network must never stop the artisan from logging out.
      await runBestEffort([
        (signal) => unregisterPush(signal),
        (signal) => call(routes.artisans.goOffline(), { signal }),
      ]);

      // 2. Tell the server to end this session (same rule).
      try {
        const refreshToken = await getRefreshToken();

        if (refreshToken) {
          await api.post('/auth/logout', { refreshToken });
        }
      } catch {
        // ignored on purpose
      }

      // 3. Wipe the tokens from the device and go back to the login screen.
      await endSession();
    } catch (error) {
      // The session was not ended (the phone could not wipe its tokens): the technician is still signed in, and the position may go out again.
      beginSession();
      throw error;
    } finally {
      setSigningOut(false);
    }
  };

  // Signing out with actions the phone has not been able to send (P3-06): they stay on the phone, for this account, and go at its next sign-in.
  // The technician is told, because the customer and the team do not know about them until then.
  const asking = useRef(false);

  const confirmLogout = async () => {
    if (signingOut || asking.current) return;

    asking.current = true;

    try {
      // The file is read first: until then the queue says it holds nothing, and the technician would sign out without the warning.
      await offlineQueue.start();
      await syncOfflineUser();
    } catch {
      // read again below: a queue that is not read says so
    } finally {
      asking.current = false;
    }

    const snapshot = offlineQueue.getSnapshot();
    const count = snapshot.entries.length;
    // Whose session is open can be unknown too (the keychain could not be read at the start, and nothing has asked again): the list then shows
    // nothing, although the file may hold this technician's actions.
    const unknown = !snapshot.ready || snapshot.loadFailed || snapshot.userId === null;

    if (count === 0 && !unknown) {
      void handleLogout();
      return;
    }

    // A list that cannot be read is told as such: it may hold actions, and they would stay on the phone without the technician knowing.
    Alert.alert(t('app.offline.signOutTitle'), unknown && count === 0 ? t('app.offline.notRead') : t('app.offline.signOutBody', { count }), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('app.offline.signOutConfirm'),
        style: 'destructive',
        onPress: () => {
          void handleLogout();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  const name = artisan?.user.name || null;
  const since = memberSince(artisan?.user.createdAt, locale);
  const notice = artisan ? verificationNotice(artisan.verificationStatus, locale) : null;
  const zones = (artisan?.serviceZones ?? []).filter((zone) => zone.isActive).map((zone) => zone.label || zone.city).filter(Boolean);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {failed && !artisan ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{t('app.profile.loadFailed')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>{t('common.actions.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : artisan ? (
        <>
      {/* Header Profile Section */}
      <View style={styles.headerCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{initialsOf(name).charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{name ?? artisan.user.email}</Text>
        <Text style={[styles.role, { letterSpacing: spacing(locale, 1) }]}>{tradesText(artisan, locale)}</Text>
        
        <View style={styles.contactStack}>
          {artisan.user.phone ? (
            <View style={styles.contactRow}>
              <Ionicons name="call" size={16} color="#B69121" />
              <Text style={[styles.contactText, styles.contactValue]}>{artisan.user.phone}</Text>
            </View>
          ) : null}
          <View style={styles.contactRow}>
            <Ionicons name="mail" size={16} color="#B69121" />
            <Text style={[styles.contactText, styles.contactValue]}>{artisan.user.email}</Text>
          </View>
          {since ? (
            <View style={styles.contactRow}>
              <Ionicons name="calendar" size={16} color="#B69121" />
              <Text style={styles.contactText}>{t('app.profile.memberSince', { date: since })}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {notice ? (
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle" size={20} color="#d97706" />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="star" size={24} color="#D4AF37" />
          <Text style={styles.statValue}>{ratingText(artisan.averageRating, artisan.ratingCount)}</Text>
          <Text style={styles.statLabel}>{artisan.ratingCount > 0 ? t('app.profile.rating', { count: artisan.ratingCount }) : t('app.profile.noRating')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Ionicons name="checkmark-done-circle" size={24} color="#D4AF37" />
          <Text style={styles.statValue}>{artisan.completedMissions}</Text>
          <Text style={styles.statLabel}>{t('app.profile.completedMissions')}</Text>
        </View>
      </View>

      {zones.length ? <Text style={styles.zonesText}>{t('app.profile.zones', { zones: joinList(zones.map((zone) => isolateFor(locale, zone ?? '')), locale) })}</Text> : null}
        </>
      ) : null}

      {/* Action Menu */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemStart}>
            <View style={styles.menuIconBox}>
              <Ionicons name="person-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>{t('app.profile.menu.info')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" style={chevron} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemStart}>
            <View style={styles.menuIconBox}>
              <Ionicons name="time-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>{t('app.profile.menu.history')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" style={chevron} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/change-password')}>
          <View style={styles.menuItemStart}>
            <View style={styles.menuIconBox}>
              <Ionicons name="lock-closed-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>{t('app.profile.menu.password')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" style={chevron} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemStart}>
            <View style={styles.menuIconBox}>
              <Ionicons name="help-buoy-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>{t('app.profile.menu.support')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" style={chevron} />
        </TouchableOpacity>
      </View>

      {/* Language (P3-04): the two languages, each in its own letters */}
      <LanguageSelector />

      {/* Logout Button */}
      <TouchableOpacity style={[styles.logoutButton, signingOut && { opacity: 0.6 }]} onPress={confirmLogout} disabled={signingOut}>
        {signingOut ? <ActivityIndicator color="#ef4444" /> : <Ionicons name="log-out-outline" size={20} color="#ef4444" />}
        <Text style={styles.logoutText}>{t('app.profile.signOut')}</Text>
      </TouchableOpacity>
      
      <Text style={styles.versionText}>{t('app.profile.version', { version: APP_VERSION })}</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9', // Stone-50 background
  },
  content: {
    padding: 20,
    paddingTop: 60, // Adjust based on your safe area
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#0f172a', // Deep Blue
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
    borderTopWidth: 4,
    borderTopColor: '#D4AF37',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D4AF37', // Gold
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  contactStack: {
    gap: 8,
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  contactText: {
    color: '#F3DFA2',
    fontWeight: '600',
  },
  // A phone number and an e-mail address keep their order inside a right-to-left screen.
  contactValue: {
    writingDirection: 'ltr',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
  },
  noticeText: {
    flex: 1,
    color: '#92400e',
    fontSize: 14,
    lineHeight: 20,
  },
  centerBox: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: '#78716c',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    color: '#D4AF37',
    fontWeight: 'bold',
  },
  zonesText: {
    color: '#78716c',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e7e5e4',
    marginHorizontal: 15,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#78716c',
    marginTop: 4,
  },
  menuContainer: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f5f5f4',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  menuItemStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1917',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 16,
    marginTop: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#a8a29e',
    fontSize: 12,
    marginTop: 24,
  }
});
