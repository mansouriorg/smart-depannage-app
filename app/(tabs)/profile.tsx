import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import api, { endSession, getRefreshToken } from '../../services/api';

export default function ProfileScreen() {
  const router = useRouter();

  // Mock data - This will eventually come from your NestJS backend
  const artisan = {
    name: "Ahmed Plombier",
    phone: "+216 55 555 555",
    email: "plombier@gmail.com",
    rating: 4.8,
    completedMissions: 124,
    joinDate: "Mars 2026",
  };

  const handleLogout = async () => {
    // 1. Tell the server to end this session (best effort: a missing network
    //    must never stop the artisan from logging out on the phone).
    try {
      const refreshToken = await getRefreshToken();

      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // ignored on purpose
    }

    // 2. Wipe the tokens from the device and go back to the login screen.
    await endSession();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Header Profile Section */}
      <View style={styles.headerCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{artisan.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{artisan.name}</Text>
        <Text style={styles.role}>Technicien Partenaire</Text>
        
        <View style={styles.contactRow}>
          <Ionicons name="call" size={16} color="#B69121" />
          <Text style={styles.contactText}>{artisan.phone}</Text>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="star" size={24} color="#D4AF37" />
          <Text style={styles.statValue}>{artisan.rating}</Text>
          <Text style={styles.statLabel}>Note globale</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Ionicons name="checkmark-done-circle" size={24} color="#D4AF37" />
          <Text style={styles.statValue}>{artisan.completedMissions}</Text>
          <Text style={styles.statLabel}>Missions terminées</Text>
        </View>
      </View>

      {/* Action Menu */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={styles.menuIconBox}>
              <Ionicons name="person-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>Mes informations</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={styles.menuIconBox}>
              <Ionicons name="time-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>Historique des interventions</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/change-password')}>
          <View style={styles.menuItemLeft}>
            <View style={styles.menuIconBox}>
              <Ionicons name="lock-closed-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>Changer mon mot de passe</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <View style={styles.menuIconBox}>
              <Ionicons name="help-buoy-outline" size={20} color="#0f172a" />
            </View>
            <Text style={styles.menuText}>Support technique</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#a8a29e" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
      
      <Text style={styles.versionText}>Smart Depannage Pro v1.0.0</Text>

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
    letterSpacing: 1,
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
  menuItemLeft: {
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
