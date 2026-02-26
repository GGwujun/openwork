// src/screens/settings/SettingsScreen.tsx
// 设置页面（占位）

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/common/Button';

export default function SettingsScreen() {
  const { logout, serverConfig } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert(
      '确认登出',
      '确定要登出吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务器信息</Text>
          <View style={styles.infoCard}>
            <Text style={styles.label}>服务器地址</Text>
            <Text style={styles.value}>{serverConfig?.url || '未配置'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账户</Text>
          <Button
            title="登出"
            variant="outline"
            onPress={handleLogout}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>OpenWork Mobile v1.0.0</Text>
        </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: 24,
  },
  version: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
