import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, View, Alert, Platform, StatusBar } from 'react-native';
import ScanHistory, { ScanItem } from '../components/ScanHistory';
import USBConnectionStatus from '../components/USBConnectionStatus';
import USBService from '../services/USBService';
import LoggingService from '../services/LoggingService';

/**
 * Screen for displaying the scan history and allowing resend of items
 */
const HistoryScreen: React.FC = () => {
  const logger = LoggingService.getInstance();
  const [selectedItem, setSelectedItem] = useState<ScanItem | null>(null);

  // Handle item selection from history
  const handleItemSelect = (item: ScanItem) => {
    setSelectedItem(item);
    
    // If the item hasn't been sent, ask if the user wants to send it
    if (!item.sent) {
      Alert.alert(
        'Send Item',
        `Do you want to send "${item.data}" to the connected USB device?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: () => {
              const usbService = USBService.getInstance();
              
              if (!usbService.isDeviceConnected()) {
                Alert.alert('Error', 'No USB device connected. Please connect a device first.');
                return;
              }
              
              // Attempt to send the data
              logger.info(`Sending item from history: ${item.data}`);
              usbService.sendData(item.data)
                .then(success => {
                  if (success) {
                    logger.info('Item sent successfully');
                    Alert.alert('Success', 'Item was sent successfully.');
                  } else {
                    logger.warn('Failed to send item');
                    Alert.alert('Error', 'Failed to send item. Please try again.');
                  }
                })
                .catch(error => {
                  logger.error('Error sending item', error);
                  Alert.alert('Error', 'An error occurred while sending the item.');
                });
            },
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      
      {/* USB Connection Status */}
      <USBConnectionStatus
        onConnect={() => logger.info('USB Connected from History UI')}
        onDisconnect={() => logger.info('USB Disconnected from History UI')}
      />
      
      {/* Scan History */}
      <View style={styles.historyContainer}>
        <ScanHistory onItemSelect={handleItemSelect} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  historyContainer: {
    flex: 1,
  },
});

export default HistoryScreen; 