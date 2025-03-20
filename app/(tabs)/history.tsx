import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HistoryScreen from '../../screens/HistoryScreen';

/**
 * History tab that displays scan history
 */
export default function History() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <HistoryScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 