import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import HomeScreen from './screens/HomeScreen';
import StatsScreen from './screens/StatsScreen';
import { SpeedProvider } from './lib/SpeedContext';

// Display incoming notifications as alerts while the app is foregrounded.
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
  // Request notification permissions on first launch.
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

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
