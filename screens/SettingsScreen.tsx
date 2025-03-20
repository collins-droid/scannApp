import React from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import SettingsForm, { AppSettings } from '../components/SettingsForm';
import LoggingService from '../services/LoggingService';

/**
 * Screen for displaying and editing app settings
 */
const SettingsScreen: React.FC = () => {
  const logger = LoggingService.getInstance();

  // Handle settings changes
  const handleSettingsChanged = (settings: AppSettings) => {
    logger.info('Settings updated', settings);
    
    // Apply the new settings
    logger.setLogLevel(settings.logLevel);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      <SettingsForm onSettingsChanged={handleSettingsChanged} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});

export default SettingsScreen; 