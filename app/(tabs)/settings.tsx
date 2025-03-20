import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettingsScreen from '../../screens/SettingsScreen';

/**
 * Settings tab that allows the user to configure app settings
 */
export default function Settings() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <SettingsScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 