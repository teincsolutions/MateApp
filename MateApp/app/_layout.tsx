import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export {
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="mapping" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="journey/new" options={{ title: 'New Journey', presentation: 'modal' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </>
  );
}
