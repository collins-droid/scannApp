import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import StorageService from '../services/StorageService';
import LoggingService, { LogLevel } from '../services/LoggingService';

// Barcode format constants since we're not using the BarCodeScanner module
const BARCODE_TYPES = {
  qr: 'org.iso.QRCode',
  code128: 'org.iso.Code128',
  code39: 'org.iso.Code39',
  ean13: 'org.gs1.EAN-13',
  ean8: 'org.gs1.EAN-8',
  upc_e: 'org.gs1.UPC-E'
};

// Define the settings interface
export interface AppSettings {
  autoSend: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  defaultBarcodeFormat: string;
  logLevel: LogLevel;
  autoConnect: boolean;
  clearHistoryOnExit: boolean;
}

// Default settings
const defaultSettings: AppSettings = {
  autoSend: true,
  vibrationEnabled: true,
  soundEnabled: true,
  defaultBarcodeFormat: BARCODE_TYPES.code128,
  logLevel: LogLevel.INFO,
  autoConnect: false,
  clearHistoryOnExit: false,
};

interface SettingsFormProps {
  onSettingsChanged?: (settings: AppSettings) => void;
}

/**
 * Component for displaying and editing app settings
 */
const SettingsForm: React.FC<SettingsFormProps> = ({ onSettingsChanged }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const storageService = StorageService.getInstance();
  const logger = LoggingService.getInstance();
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Load settings from storage
  const loadSettings = async () => {
    try {
      const savedSettings = await storageService.getObject<AppSettings>('appSettings');
      
      if (savedSettings) {
        setSettings(savedSettings);
        logger.info('Settings loaded from storage');
        
        // Update logger level
        logger.setLogLevel(savedSettings.logLevel);
      }
    } catch (error) {
      logger.error('Error loading settings', error);
    }
  };

  // Save settings to storage
  const saveSettings = async (updatedSettings: AppSettings) => {
    try {
      await storageService.storeObject('appSettings', updatedSettings);
      logger.info('Settings saved to storage');
      
      if (onSettingsChanged) {
        onSettingsChanged(updatedSettings);
      }
    } catch (error) {
      logger.error('Error saving settings', error);
    }
  };

  // Update a specific setting
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    
    // Update logger level if that setting changed
    if (key === 'logLevel') {
      logger.setLogLevel(value as LogLevel);
    }
  };

  // Reset settings to default
  const resetSettings = () => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
    logger.setLogLevel(defaultSettings.logLevel);
    logger.info('Settings reset to default');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>App Settings</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scanning Options</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto-send scanned barcodes</Text>
          <Switch
            value={settings.autoSend}
            onValueChange={(value) => updateSetting('autoSend', value)}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Vibration feedback</Text>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={(value) => updateSetting('vibrationEnabled', value)}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Sound feedback</Text>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(value) => updateSetting('soundEnabled', value)}
          />
        </View>
        
        <Text style={styles.settingLabel}>Default barcode format</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={settings.defaultBarcodeFormat}
            onValueChange={(value) => updateSetting('defaultBarcodeFormat', value)}
            style={styles.picker}
          >
            <Picker.Item label="QR Code" value={BARCODE_TYPES.qr} />
            <Picker.Item label="Code 128" value={BARCODE_TYPES.code128} />
            <Picker.Item label="Code 39" value={BARCODE_TYPES.code39} />
            <Picker.Item label="EAN-13" value={BARCODE_TYPES.ean13} />
            <Picker.Item label="EAN-8" value={BARCODE_TYPES.ean8} />
            <Picker.Item label="UPC-E" value={BARCODE_TYPES.upc_e} />
          </Picker>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Options</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto-connect to USB</Text>
          <Switch
            value={settings.autoConnect}
            onValueChange={(value) => updateSetting('autoConnect', value)}
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Clear history on exit</Text>
          <Switch
            value={settings.clearHistoryOnExit}
            onValueChange={(value) => updateSetting('clearHistoryOnExit', value)}
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Options</Text>
        
        <Text style={styles.settingLabel}>Log level</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={settings.logLevel}
            onValueChange={(value) => updateSetting('logLevel', value as LogLevel)}
            style={styles.picker}
          >
            <Picker.Item label="Debug (Verbose)" value={LogLevel.DEBUG} />
            <Picker.Item label="Info (Normal)" value={LogLevel.INFO} />
            <Picker.Item label="Warning" value={LogLevel.WARN} />
            <Picker.Item label="Error (Minimal)" value={LogLevel.ERROR} />
          </Picker>
        </View>
      </View>
      
      <TouchableOpacity style={styles.resetButton} onPress={resetSettings}>
        <Text style={styles.resetButtonText}>Reset to Default</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#444',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#555',
    flex: 1,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  resetButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsForm; 