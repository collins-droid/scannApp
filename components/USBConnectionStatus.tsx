import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import USBService from '../services/USBService';
import LoggingService from '../services/LoggingService';

interface USBConnectionStatusProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Component for displaying USB connection status and allowing connection management
 */
const USBConnectionStatus: React.FC<USBConnectionStatusProps> = ({
  onConnect,
  onDisconnect,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const usbService = USBService.getInstance();
  const logger = LoggingService.getInstance();

  // Monitor USB connection status
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        logger.info('USB device connected');
        onConnect && onConnect();
      } else {
        logger.info('USB device disconnected');
        onDisconnect && onDisconnect();
      }
    };

    // Check initial connection status
    const checkConnection = async () => {
      const connected = usbService.isDeviceConnected();
      setIsConnected(connected);
    };

    checkConnection();

    // Setup event listener
    usbService.addEventListener('connectionChange', handleConnectionChange);

    // Cleanup
    return () => {
      usbService.removeEventListener('connectionChange', handleConnectionChange);
    };
  }, [usbService, onConnect, onDisconnect]);

  // Handle connect button press
  const handleConnectPress = async () => {
    try {
      logger.info('Attempting to connect to USB device');
      const success = await usbService.connect();
      
      if (!success) {
        logger.warn('Failed to connect to USB device');
      }
    } catch (error) {
      logger.error('Error connecting to USB device', error);
    }
  };

  // Handle disconnect button press
  const handleDisconnectPress = () => {
    try {
      logger.info('Disconnecting from USB device');
      usbService.disconnect();
    } catch (error) {
      logger.error('Error disconnecting from USB device', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusIndicator, isConnected ? styles.connected : styles.disconnected]}>
        <FontAwesome
          name={isConnected ? 'usb' : 'times-circle'}
          size={16}
          color={isConnected ? '#fff' : '#fff'}
        />
        <Text style={styles.statusText}>
          {isConnected ? 'USB Connected' : 'USB Disconnected'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, isConnected ? styles.disconnectButton : styles.connectButton]}
        onPress={isConnected ? handleDisconnectPress : handleConnectPress}
      >
        <Text style={styles.buttonText}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    margin: 5,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    marginLeft: 5,
    color: '#fff',
    fontWeight: 'bold',
  },
  connected: {
    backgroundColor: '#4CAF50',
  },
  disconnected: {
    backgroundColor: '#F44336',
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  connectButton: {
    backgroundColor: '#2196F3',
  },
  disconnectButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default USBConnectionStatus; 