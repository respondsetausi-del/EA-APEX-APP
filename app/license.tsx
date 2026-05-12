import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useApp } from '@/providers/app-provider';
import { apiService } from '@/services/api';
import Colors, { neonWebShadow } from '@/constants/colors';
import { APEX_LOGO } from '@/constants/brand-assets';

export default function LicenseScreen() {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const { addEA, eas, glowColor, isHydrated, emailAuthenticated } = useApp();
  const hasActiveBots = eas.length > 0;
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalMessage, setModalMessage] = useState<string>('');

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('Error', 'Please enter a valid license key');
      return;
    }

    // Check if license key already exists
    const existingEA = eas.find(ea => ea.licenseKey.toLowerCase().trim() === licenseKey.trim().toLowerCase());
    if (existingEA) {
      setModalTitle('License Already Added');
      setModalMessage('This license key is already added on this device.');
      setModalVisible(true);
      return;
    }

    setIsActivating(true);

    try {
      console.log('Starting license activation process...');

      // Attempt: authenticate with just the license key
      const authResponse = await apiService.authenticateLicense({
        licence: licenseKey.trim(),
      });

      if (authResponse.message === 'used') {
        setModalTitle('License Already Used');
        setModalMessage('This license key is bound to another device. Please contact support if you need assistance.');
        setModalVisible(true);
        return;
      }

      if (authResponse.message !== 'accept' || !authResponse.data) {
        setModalTitle('Invalid License');
        setModalMessage('The license key does not exist or authentication failed.');
        setModalVisible(true);
        return;
      }

      // Success path
      const data = authResponse.data;

      // Generate unique ID
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 9);
      const keyHash = licenseKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueId = `ea_${timestamp}_${randomPart}_${keyHash}`;

      const newEA = {
        id: uniqueId,
        name: data.ea_name || 'EA CONVERTER',
        licenseKey: licenseKey.trim(),
        status: 'connected' as const,
        description: (data.owner && data.owner.name) ? data.owner.name : 'EA CONVERTER',
        phoneSecretKey: data.phone_secret_key,
        userData: data,
      };

      const success = await addEA(newEA);
      if (success) {
        // Wait longer to ensure state is fully updated before navigation
        await new Promise(resolve => setTimeout(resolve, 600));
        console.log('License added successfully, navigating to tabs...');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Failed to save this license locally.');
      }
    } catch (error) {
      console.error('Critical error during license activation:', error);
      Alert.alert('Network Error', 'Failed to reach the server. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Block the render until hydration completes and the AuthGate has had a
  // chance to evaluate. If the user somehow reached this screen without
  // email auth, AuthGate redirects — we just refuse to paint the form in
  // the meantime.
  if (!isHydrated || !emailAuthenticated) {
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {hasActiveBots && (
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { borderColor: glowColor + '30' }]} onPress={handleBack}>
            <ArrowLeft size={24} color={glowColor} />
          </TouchableOpacity>
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View
                style={[
                  styles.logoRing,
                  Platform.OS === 'web' && { borderWidth: 0, boxShadow: neonWebShadow(glowColor, 'medium') } as any,
                  { borderColor: glowColor + '40' },
                ]}
              >
                <Image source={APEX_LOGO} style={styles.appIcon} resizeMode="contain" />
              </View>
              <Text style={[
                styles.title,
                {
                  color: glowColor,
                  textShadowColor: glowColor + '66',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 12,
                },
              ]}>
                EA APEX
              </Text>
              <Text style={[styles.subtitle, { color: glowColor + '99' }]}>License Activation</Text>
            </View>

            <View style={styles.form}>
              <View
                style={[
                  styles.inputShell,
                  Platform.OS === 'web' && { borderWidth: 0, boxShadow: neonWebShadow(glowColor, 'soft') } as any,
                  { borderColor: glowColor + '35' },
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="License Key"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  value={licenseKey}
                  onChangeText={setLicenseKey}
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.activateButton,
                  { backgroundColor: glowColor },
                  Platform.OS === 'web' && { boxShadow: neonWebShadow(glowColor, 'medium') } as any,
                  isActivating && styles.activateButtonDisabled,
                ]}
                onPress={handleActivate}
                disabled={isActivating}
              >
                {isActivating ? (
                  <View style={styles.activatingContainer}>
                    <ActivityIndicator size="small" color="#0a0a0c" />
                    <Text style={styles.activateButtonText}>Activating...</Text>
                  </View>
                ) : (
                  <Text style={styles.activateButtonText}>Activate EA</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.hint, { color: glowColor + '66' }]}>
                Enter your license key to activate your EA
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoRing: {
    width: 108,
    height: 108,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  appIcon: {
    width: 88,
    height: 88,
    borderRadius: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 18,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 6,
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },
  inputShell: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#000000',
    marginBottom: 14,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  activateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  activateButtonDisabled: {
    opacity: 0.7,
  },
  activateButtonText: {
    color: '#0a0a0c',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 8,
  },
  activatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#000000',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 251, 255, 0.22)',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#0a0a0c',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
