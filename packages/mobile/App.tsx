// App.tsx
// 应用入口

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import Navigation from '@/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <Navigation />
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
