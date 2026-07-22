import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "MateApp",
  slug: "MateApp",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#2563EB",
  },
  scheme: "mateapp",
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/ca4ac20b-0e4d-444e-bb12-c6cfacae6fd1",
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow MateApp to use your location for route mapping.",
      },
    ],
    [
      "react-native-maps",
      {
        iosGoogleMapsApiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || "",
        androidGoogleMapsApiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || "",
      },
    ],
    "expo-sqlite",
    "expo-sharing",
    "expo-splash-screen",
    "expo-status-bar",
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.teincsolutions.mateapp",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "MateApp needs your location to map transport routes.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "MateApp needs your location to map transport routes even in the background.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.teincsolutions.mateapp",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "FOREGROUND_SERVICE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    router: {},
    eas: {
      projectId: "ca4ac20b-0e4d-444e-bb12-c6cfacae6fd1",
    },
  },
  owner: "teincsolutions",
});
