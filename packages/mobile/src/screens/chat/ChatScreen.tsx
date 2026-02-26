// src/screens/chat/ChatScreen.tsx
// 聊天页面（占位）

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSessionStore } from '@/store/sessionStore';

export default function ChatScreen() {
  const route = useRoute();
  const { currentSessionId } = useSessionStore();
  
  // const { sessionId } = route.params as { sessionId: string };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>聊天</Text>
        <Text style={styles.sessionId}>会话ID: {currentSessionId}</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.placeholder}>聊天功能开发中...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  sessionId: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 16,
    color: '#64748b',
  },
});
