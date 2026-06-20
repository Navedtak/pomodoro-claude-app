import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import HomeScreen from './screens/HomeScreen';
import StatsScreen from './screens/StatsScreen';
import AuthScreen from './screens/AuthScreen';
import { SpeedProvider } from './lib/SpeedContext';
import { supabase } from './lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#EDFCE5' }} />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <SpeedProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#4A8230',
            tabBarInactiveTintColor: '#AAA',
            tabBarStyle: { paddingTop: 4 },
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
                {route.name === 'Focus' ? '🌱' : '🌳'}
              </Text>
            ),
          })}
        >
          <Tab.Screen name="Focus" component={HomeScreen} />
          <Tab.Screen name="Stats" component={StatsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SpeedProvider>
  );
}
