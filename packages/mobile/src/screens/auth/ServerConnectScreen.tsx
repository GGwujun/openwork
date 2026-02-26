// src/screens/auth/ServerConnectScreen.tsx
// 服务器连接页面

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { isValidUrl } from '@/utils/helpers';

export default function ServerConnectScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const navigation = useNavigation();
  
  const { setServerUrl: connectToServer, error, clearError } = useAuthStore();

  const handleConnect = async () => {
    // 验证URL
    if (!serverUrl.trim()) {
      Alert.alert('错误', '请输入服务器地址');
      return;
    }

    let url = serverUrl.trim();
    // 自动添加https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    if (!isValidUrl(url)) {
      Alert.alert('错误', '请输入有效的服务器地址');
      return;
    }

    clearError();
    setIsConnecting(true);

    try {
      const result = await connectToServer(url);
      
      if (result.success) {
        // 连接成功，进入设备注册
        // TODO: 导航到设备注册页面
        Alert.alert('成功', '服务器连接成功！');
      } else {
        Alert.alert('连接失败', result.error || '无法连接到服务器');
      }
    } catch (err) {
      Alert.alert('错误', '发生未知错误');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>OpenWork</Text>
            <Text style={styles.title}>连接到你的服务器</Text>
            <Text style={styles.subtitle}>
              输入你的OpenWork服务器地址以继续
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="服务器地址"
              placeholder="https://your-server.com"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              helper="例如: https://owpenbot.example.com"
            />

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <Button
              title={isConnecting ? '连接中...' : '连接服务器'}
              onPress={handleConnect}
              loading={isConnecting}
              disabled={isConnecting}
              size="large"
            />

            <Text style={styles.helpText}>
              不知道如何获取服务器地址？
              {' '}
              <Text style={styles.helpLink} onPress={() => {
                // TODO: 打开帮助文档
                Alert.alert('帮助', '请联系你的系统管理员获取服务器地址');
              }}>
                查看帮助
              </Text>
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.version}>OpenWork Mobile v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  helpText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: '#64748b',
  },
  helpLink: {
    color: '#3b82f6',
    fontWeight: '500',
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
