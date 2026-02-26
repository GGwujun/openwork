// src/navigation/index.tsx
// 导航配置

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';

// 导入屏幕组件（稍后创建）
import ServerConnectScreen from '@/screens/auth/ServerConnectScreen';
import SessionListScreen from '@/screens/session/SessionListScreen';
import ChatScreen from '@/screens/chat/ChatScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';

// 导航类型
import { RootStackParamList, AuthStackParamList, MainTabParamList, WorkbenchStackParamList } from '@/types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const WorkbenchStack = createNativeStackNavigator<WorkbenchStackParamList>();

// 工作台导航
function WorkbenchNavigator() {
  return (
    <WorkbenchStack.Navigator>
      <WorkbenchStack.Screen
        name="SessionList"
        component={SessionListScreen}
        options={{ headerShown: false }}
      />
      <WorkbenchStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </WorkbenchStack.Navigator>
  );
}

// 认证导航
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="ServerConnect" component={ServerConnectScreen} />
    </AuthStack.Navigator>
  );
}

// 主标签导航
function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <MainTab.Screen
        name="Workbench"
        component={WorkbenchNavigator}
        options={{
          tabBarLabel: '工作台',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="home" size={size} color={color} />
          // ),
        }}
      />
      <MainTab.Screen
        name="Explorer"
        component={View} // 占位，稍后实现
        options={{
          tabBarLabel: '探索',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="folder" size={size} color={color} />
          // ),
        }}
      />
      <MainTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '设置',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="settings" size={size} color={color} />
          // ),
        }}
      />
    </MainTab.Navigator>
  );
}

// 根导航
export default function Navigation() {
  const { isAuthenticated, serverConfig } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查存储中是否有认证信息
    // 这里可以添加启动时的初始化逻辑
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <RootStack.Screen name="Main" component={MainNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
