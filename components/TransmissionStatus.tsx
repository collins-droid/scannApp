import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import USBService from '../services/USBService';

export enum TransmissionState {
  IDLE = 'idle',
  SENDING = 'sending',
  SUCCESS = 'success',
  ERROR = 'error',
}

interface TransmissionStatusProps {
  barcode?: string;
}

/**
 * Component for displaying data transmission status as an overlay
 */
const TransmissionStatus: React.FC<TransmissionStatusProps> = ({ barcode }) => {
  const [state, setState] = useState<TransmissionState>(TransmissionState.IDLE);
  const [message, setMessage] = useState<string>('');
  const [visible, setVisible] = useState<boolean>(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  const usbService = USBService.getInstance();

  // Handle data sending and status updates
  useEffect(() => {
    // Auto-hide the overlay after success or error
    if (state === TransmissionState.SUCCESS || state === TransmissionState.ERROR) {
      const timeout = setTimeout(() => {
        fadeOut();
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [state]);

  // Listen for barcode changes to initiate transmission
  useEffect(() => {
    if (barcode && usbService.isDeviceConnected()) {
      setVisible(true);
      fadeIn();
      setState(TransmissionState.SENDING);
      setMessage(`Sending barcode: ${barcode}`);
      
      // Simulate sending data to USB device
      const sendData = async () => {
        try {
          const success = await usbService.sendData(barcode);
          
          if (success) {
            setState(TransmissionState.SUCCESS);
            setMessage('Data sent successfully');
          } else {
            setState(TransmissionState.ERROR);
            setMessage('Failed to send data');
          }
        } catch (error) {
          setState(TransmissionState.ERROR);
          setMessage('Error sending data');
          console.error('Error sending barcode data:', error);
        }
      };
      
      sendData();
    }
  }, [barcode]);

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setState(TransmissionState.IDLE);
      setMessage('');
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.content, getBackgroundStyle(state)]}>
        {renderStatusIcon(state)}
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
};

// Helper function to render the appropriate icon based on state
const renderStatusIcon = (state: TransmissionState) => {
  switch (state) {
    case TransmissionState.SENDING:
      return <ActivityIndicator size="small" color="#fff" />;
    case TransmissionState.SUCCESS:
      return <FontAwesome name="check-circle" size={24} color="#fff" />;
    case TransmissionState.ERROR:
      return <FontAwesome name="exclamation-circle" size={24} color="#fff" />;
    default:
      return null;
  }
};

// Helper function to get the background style based on state
const getBackgroundStyle = (state: TransmissionState) => {
  switch (state) {
    case TransmissionState.SENDING:
      return styles.sending;
    case TransmissionState.SUCCESS:
      return styles.success;
    case TransmissionState.ERROR:
      return styles.error;
    default:
      return {};
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: '80%',
    justifyContent: 'center',
  },
  message: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  sending: {
    backgroundColor: '#2196F3',
  },
  success: {
    backgroundColor: '#4CAF50',
  },
  error: {
    backgroundColor: '#F44336',
  },
});

export default TransmissionStatus; 