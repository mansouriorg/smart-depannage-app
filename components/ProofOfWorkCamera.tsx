import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Define the shape of the data we send back to the Mission Details screen
interface ProofData {
  uri: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface ProofOfWorkCameraProps {
  onCaptureComplete: (data: ProofData) => void;
  /** Lets the artisan leave the camera without taking a photo. */
  onCancel?: () => void;
}

export default function ProofOfWorkCamera({ onCaptureComplete, onCancel }: ProofOfWorkCameraProps) {
  // 1. Hardware Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationStatus, requestLocationPermission] = Location.useForegroundPermissions();

  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<any>(null);

  // Ask for permissions as soon as the camera screen opens
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!locationStatus?.granted) await requestLocationPermission();
    })();
  }, []);

  // --- PERMISSION STATES ---
  
  if (!cameraPermission || !locationStatus) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Vérification des autorisations...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !locationStatus.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          L'application a absolument besoin de la caméra et de votre position GPS pour créer une preuve de travail valide.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={async () => {
            await requestCameraPermission();
            await requestLocationPermission();
          }}
        >
          <Text style={styles.retryButtonText}>Autoriser l'accès</Text>
        </TouchableOpacity>
        {onCancel && (
          <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
            <Text style={styles.cancelLinkText}>Retour</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // --- CAPTURE LOGIC ---

  const takeTamperProofPhoto = async () => {
    if (!cameraRef.current) return;
    setIsProcessing(true); // Disable the button while processing

    try {
      // A. Take the photo (quality 0.7 reduces file size while keeping details)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false, 
      });

      // B. Instantly grab the GPS coordinates
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      // C. Package the "Proof"
      const proofData: ProofData = {
        uri: photo.uri,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      // D. Send it up to the parent component to upload!
      onCaptureComplete(proofData);
      
    } catch (error) {
      console.error("Erreur lors de la capture :", error);
      setIsProcessing(false);
      Alert.alert(
        "Capture impossible",
        "La photo ou la position GPS n'a pas pu être enregistrée. Vérifiez que le GPS est activé puis réessayez.",
      );
    }
  };

  // --- RENDER CAMERA ---

  return (
    <View style={styles.container}>
      {/* Modern Expo CameraView */}
      <CameraView
        style={styles.camera}
        facing="back"
        ref={cameraRef}
        animateShutter={true}
      >
        <View style={styles.overlay}>
          
          {/* Top Banner: Instructions */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Preuve de Travail</Text>
            <Text style={styles.subHeaderText}>GPS et Heure enregistrés automatiquement</Text>
          </View>

          {/* Bottom Banner: Shutter Button */}
          <View style={styles.footer}>
            {onCancel && (
              <TouchableOpacity style={styles.cancelLink} onPress={onCancel} disabled={isProcessing}>
                <Text style={styles.cancelLinkText}>Annuler</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.captureOuterRing, isProcessing && styles.captureOuterRingDisabled]}
              onPress={takeTamperProofPhoto}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#0f172a" size="large" />
              ) : (
                <View style={styles.captureInnerCircle} />
              )}
            </TouchableOpacity>
          </View>

        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between', // Pushes header to top, footer to bottom
    paddingVertical: 40,
  },
  
  // Header Info
  header: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)', // Semi-transparent dark blue
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerText: {
    color: '#D4AF37', // Gold
    fontSize: 18,
    fontWeight: 'bold',
  },
  subHeaderText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 4,
  },

  // Footer / Capture Button
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureOuterRingDisabled: {
    borderColor: '#64748b',
    backgroundColor: '#e2e8f0',
  },
  captureInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D4AF37',
  },

  // State Screens (Loading / Permissions)
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  loadingText: {
    color: '#D4AF37',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelLink: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  cancelLinkText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButtonText: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
