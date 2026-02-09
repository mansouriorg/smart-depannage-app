import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ROLES } from '../../constants/Roles';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!username || !selectedRole) {
      Alert.alert('Missing Info', 'Please enter your name and select your role.');
      return;
    }

    setLoading(true);

    // SIMULATE API CALL
    setTimeout(() => {
      setLoading(false);
      // Navigate to the main app and replace the history so they can't go "back" to login
      router.replace('/(tabs)'); 
    }, 1000);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        
        {/* LOGO AREA */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>🛠️ Smart Depannage</Text>
          <Text style={styles.subtitle}>Worker App Portal</Text>
        </View>

        {/* INPUTS */}
        <View style={styles.form}>
          <Text style={styles.label}>Worker Name</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Mahmoud" 
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
          />

          <Text style={styles.label}>Select Your Profession</Text>
          <View style={styles.roleContainer}>
            {Object.values(ROLES).map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton, 
                  selectedRole === role && styles.roleButtonActive
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <Text style={[
                  styles.roleText, 
                  selectedRole === role && styles.roleTextActive
                ]}>
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* LOGIN BUTTON */}
          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Signing in..." : "Start Work Day"}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  roleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleButtonActive: {
    backgroundColor: '#E5F1FF',
    borderColor: '#007AFF',
  },
  roleText: {
    color: '#666',
    fontWeight: '500',
  },
  roleTextActive: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#A0CFFF',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});