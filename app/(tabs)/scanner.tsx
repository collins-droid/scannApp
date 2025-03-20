import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScannerScreen from '../../screens/ScannerScreen';

/**
 * Scanner tab that displays the barcode scanner
 */
function Scanner() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScannerScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default Scanner; 