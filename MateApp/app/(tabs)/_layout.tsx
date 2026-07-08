import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2563EB' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="journeys" options={{ title: 'Journeys', tabBarLabel: 'Journeys' }} />
      <Tabs.Screen name="validate" options={{ title: 'Validate', tabBarLabel: 'Validate' }} />
      <Tabs.Screen name="export" options={{ title: 'Export', tabBarLabel: 'Export' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
