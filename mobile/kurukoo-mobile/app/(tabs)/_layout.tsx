import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const tabIcons = {
  index: "bubble.left.and.bubble.right.fill",
  discover: "map.fill",
  requests: "list.bullet.rectangle.fill",
  tasks: "checklist",
  connect: "link.circle.fill",
} as const;

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginBottom: 2 },
        tabBarStyle: {
          height: 64 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarIcon: ({ color, size }) => <IconSymbol name={tabIcons[route.name as keyof typeof tabIcons]} size={size} color={color} />,
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Agent" }} />
      <Tabs.Screen name="discover" options={{ title: "Discover" }} />
      <Tabs.Screen name="requests" options={{ title: "Requests" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="connect" options={{ title: "Connect" }} />
    </Tabs>
  );
}