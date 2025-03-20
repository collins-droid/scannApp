import React from 'react';
import { SafeAreaView, StyleSheet, Platform, StatusBar } from 'react-native';
import ScannerScreen from '../../screens/ScannerScreen';

export default function Scanner() {
  return (
    <SafeAreaView style={styles.container}>
      <ScannerScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
}); 