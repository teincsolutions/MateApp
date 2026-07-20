import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, title: "Home" }}
        />
        <Stack.Screen
          name="mapping"
          options={{ headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="journey/new"
          options={{ title: "New Journey", presentation: "modal" }}
        />

        <Stack.Screen
          name="manage"
          options={{
            title: "Manage Data",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen name="manage/stops" options={{ title: "Stops" }} />
        <Stack.Screen
          name="manage/stops/[id]"
          options={{ title: "Edit Stop" }}
        />
        <Stack.Screen name="manage/areas" options={{ title: "Areas" }} />
        <Stack.Screen
          name="manage/areas/[id]"
          options={{ title: "Edit Area" }}
        />
        <Stack.Screen
          name="manage/fare-levels"
          options={{ title: "Fare Levels" }}
        />
        <Stack.Screen
          name="manage/fare-levels/[id]"
          options={{ title: "Edit Fare Level" }}
        />
        <Stack.Screen
          name="manage/journeys/[id]"
          options={{ title: "Edit Journey", headerBackTitle: "Back" }}
        />
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
    </>
  );
}
