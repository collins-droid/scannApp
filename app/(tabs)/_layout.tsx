import { Tabs } from 'expo-router';
import React from 'react';
import { FontAwesome } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof FontAwesome.glyphMap;

          if (route.name === 'scanner') {
            iconName = 'barcode';
          } else if (route.name === 'history') {
            iconName = 'history';
          } else if (route.name === 'settings') {
            iconName = 'cog';
          } else {
            iconName = 'question-circle';
          }

          return <FontAwesome name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          height: 55,
        },
        headerShown: false,
      })}>
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scan',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
