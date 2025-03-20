import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import BarcodeService from '../services/BarcodeService';
import USBService from '../services/USBService';
import LoggingService from '../services/LoggingService';

export interface ScanItem {
  id: string;
  data: string;
  timestamp: Date;
  sent: boolean;
}

interface ScanHistoryProps {
  onItemSelect?: (item: ScanItem) => void;
}

/**
 * Component for displaying the history of scanned barcodes
 */
const ScanHistory: React.FC<ScanHistoryProps> = ({ onItemSelect }) => {
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const barcodeService = BarcodeService.getInstance();
  const usbService = USBService.getInstance();
  const logger = LoggingService.getInstance();

  // Load scan history on mount
  useEffect(() => {
    loadScanHistory();
  }, []);

  // Load scan history from service
  const loadScanHistory = () => {
    try {
      setLoading(true);
      // Use the enhanced BarcodeService that now returns ScanItem objects directly
      const history = barcodeService.getScanHistory();
      
      setScanItems(history);
      logger.info(`Loaded ${history.length} items from scan history`);
    } catch (error) {
      logger.error('Error loading scan history', error);
    } finally {
      setLoading(false);
    }
  };

  // Send item to USB device
  const sendItem = async (item: ScanItem) => {
    if (!usbService.isDeviceConnected()) {
      Alert.alert('Error', 'No USB device connected. Please connect a device first.');
      return;
    }

    try {
      setSending(prev => ({ ...prev, [item.id]: true }));
      logger.info(`Sending item to USB: ${item.data}`);
      
      const success = await usbService.sendData(item.data);
      
      if (success) {
        // Update item as sent
        setScanItems(prev =>
          prev.map(scanItem =>
            scanItem.id === item.id ? { ...scanItem, sent: true } : scanItem
          )
        );
        logger.info(`Successfully sent item: ${item.data}`);
      } else {
        Alert.alert('Error', 'Failed to send data to USB device.');
        logger.warn(`Failed to send item: ${item.data}`);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while sending data.');
      logger.error(`Error sending item: ${item.data}`, error);
    } finally {
      setSending(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Clear scan history
  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all scan history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            barcodeService.clearScanHistory();
            setScanItems([]);
            logger.info('Scan history cleared');
          },
        },
      ]
    );
  };

  // Render each scan item
  const renderItem = ({ item }: { item: ScanItem }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => onItemSelect && onItemSelect(item)}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemData} numberOfLines={1} ellipsizeMode="middle">
          {item.data}
        </Text>
        <Text style={styles.itemTimestamp}>
          {item.timestamp.toLocaleTimeString()}
        </Text>
      </View>
      
      <View style={styles.itemActions}>
        {item.sent ? (
          <FontAwesome name="check-circle" size={20} color="#4CAF50" />
        ) : sending[item.id] ? (
          <ActivityIndicator size="small" color="#2196F3" />
        ) : (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => sendItem(item)}
          >
            <FontAwesome name="send" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading scan history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
        {scanItems.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
            <FontAwesome name="trash" size={18} color="#F44336" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {scanItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="barcode" size={48} color="#ddd" />
          <Text style={styles.emptyText}>No scan history yet</Text>
          <Text style={styles.emptySubText}>
            Scanned barcodes will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={scanItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  clearButtonText: {
    marginLeft: 4,
    color: '#F44336',
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemData: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#444',
  },
  itemTimestamp: {
    fontSize: 14,
    color: '#888',
  },
  itemActions: {
    marginLeft: 12,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#888',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ScanHistory; 