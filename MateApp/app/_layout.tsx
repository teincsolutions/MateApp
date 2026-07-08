import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="mapping/index" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="journey/new" options={{ title: 'New Journey', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
