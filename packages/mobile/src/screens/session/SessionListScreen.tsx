// src/screens/session/SessionListScreen.tsx
// 会话列表页面

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSessionStore } from '@/store/sessionStore';
import { Session } from '@/types';
import { formatRelativeTime } from '@/utils/helpers';
import Button from '@/components/common/Button';

export default function SessionListScreen() {
  const navigation = useNavigation();
  const {
    sessions,
    isLoading,
    fetchSessions,
    createSession,
    deleteSession,
    setCurrentSession,
  } = useSessionStore();

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async () => {
    const session = await createSession();
    if (session) {
      // 导航到聊天页面
      // navigation.navigate('Chat', { sessionId: session.id });
    }
  };

  const handleSessionPress = (session: Session) => {
    setCurrentSession(session.id);
    // navigation.navigate('Chat', { sessionId: session.id });
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const renderSessionItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => handleSessionPress(item)}
      onLongPress={() => handleDeleteSession(item.id)}
    >
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle} numberOfLines={1}>
          {item.title || '未命名会话'}
        </Text>
        <Text style={styles.sessionTime}>
          {formatRelativeTime(item.lastMessageAt || item.updatedAt)}
        </Text>
      </View>
      
      <Text style={styles.sessionInfo}>
        {item.messageCount} 条消息
        {item.unreadCount > 0 && ` • ${item.unreadCount} 未读`}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>还没有会话</Text>
      <Text style={styles.emptySubtitle}>
        点击下方的按钮创建你的第一个会话
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>工作台</Text>
        <TouchableOpacity onPress={handleCreateSession}>
          <Text style={styles.createButton}>+ 新建</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        renderItem={renderSessionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchSessions} />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  createButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  sessionTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  sessionInfo: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
