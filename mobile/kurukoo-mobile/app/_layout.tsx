import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Easing, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FirstLaunchVerification } from "@/components/first-launch-verification";
import { loadDeviceVerificationState, saveDeviceVerificationState, type DeviceVerificationState } from "@/lib/device-verification";
import type { NotificationResponse } from "expo-notifications";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { SafeAreaFrameContext, SafeAreaInsetsContext, SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { KurukooContextProvider, useKurukooContext } from "@/lib/kurukoo-context";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { configureLocalNotifications, parseTaskNotificationData, registerNativeFcmTokenIfPermitted } from "@/lib/notifications";
import { drainOfflineQueue } from "@/lib/offline-queue";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };
export const unstable_settings = { anchor: "(tabs)" };

function NotificationObserver() {
  const router = useRouter(); const { setActiveTask } = useKurukooContext();
  useEffect(() => { if (Platform.OS === "web") return; let cancelled = false; let subscription: { remove: () => void } | undefined; const redirect = (response: NotificationResponse | null) => { const task = parseTaskNotificationData(response?.notification.request.content.data); if (!task) return; setActiveTask({ kind: "task", id: task.taskId, title: task.taskTitle }); router.push(task.url); }; void (async () => { const Notifications = await import("expo-notifications"); if (cancelled) return; await configureLocalNotifications(); if (cancelled) return; void registerNativeFcmTokenIfPermitted().then((result) => { if (result.status !== "registered" && result.status !== "permission-required" && result.status !== "ios-native-provider-required") console.warn("[Kurukoo FCM] native registration:", result.detail); }).catch((error) => console.warn("[Kurukoo FCM] native registration failed", error)); redirect(Notifications.getLastNotificationResponse()); subscription = Notifications.addNotificationResponseReceivedListener(redirect); })(); return () => { cancelled = true; subscription?.remove(); }; }, [router, setActiveTask]);
  return null;
}

function OfflineQueueObserver() {
  useEffect(() => { if (Platform.OS === "web") return; const drain = () => { void drainOfflineQueue().catch((error) => console.warn("[Kurukoo offline queue] drain failed", error)); }; drain(); const timer = setInterval(drain, 10_000); const sub = AppState.addEventListener("change", (state) => { if (state === "active") drain(); }); return () => { clearInterval(timer); sub.remove(); }; }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS; const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets); const [frame, setFrame] = useState<Rect>(initialFrame); const [deviceVerificationState, setDeviceVerificationState] = useState<DeviceVerificationState | null>(null); const [verificationLoaded, setVerificationLoaded] = useState(false); const contentOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => { initManusRuntime(); }, []);
  useEffect(() => { let cancelled = false; void loadDeviceVerificationState().then((state) => { if (cancelled) return; setDeviceVerificationState(state); setVerificationLoaded(true); }); return () => { cancelled = true; }; }, []);
  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => { setInsets(metrics.insets); setFrame(metrics.frame); }, []);
  useEffect(() => { if (Platform.OS !== "web") return; const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate); return () => unsubscribe(); }, [handleSafeAreaUpdate]);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })); const [trpcClient] = useState(() => createTRPCClient());
  const providerInitialMetrics = useMemo(() => { const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame }; return { ...metrics, insets: { ...metrics.insets, top: Math.max(metrics.insets.top, 16), bottom: Math.max(metrics.insets.bottom, 12) } }; }, [initialInsets, initialFrame]);
  useEffect(() => { if (!deviceVerificationState) return; contentOpacity.setValue(0); Animated.timing(contentOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [contentOpacity, deviceVerificationState]);
  if (!fontsLoaded || !verificationLoaded) return null;
  const completeDeviceVerification = (state: DeviceVerificationState) => { void saveDeviceVerificationState(state).then(() => setDeviceVerificationState(state)); };
  const content = deviceVerificationState ? <Animated.View style={{ flex: 1, opacity: contentOpacity }}><GestureHandlerRootView style={{ flex: 1 }}><trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><KurukooContextProvider><NotificationObserver /><OfflineQueueObserver /><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="oauth/callback" /><Stack.Screen name="scan" /></Stack><StatusBar style="auto" /></KurukooContextProvider></QueryClientProvider></trpc.Provider></GestureHandlerRootView></Animated.View> : <GestureHandlerRootView style={{ flex: 1 }}><FirstLaunchVerification onComplete={completeDeviceVerification} /></GestureHandlerRootView>;
  const shouldOverrideSafeArea = Platform.OS === "web";
  if (shouldOverrideSafeArea) return <ThemeProvider><SafeAreaProvider initialMetrics={providerInitialMetrics}><SafeAreaFrameContext.Provider value={frame}><SafeAreaInsetsContext.Provider value={insets}>{content}</SafeAreaInsetsContext.Provider></SafeAreaFrameContext.Provider></SafeAreaProvider></ThemeProvider>;
  return <ThemeProvider><SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider></ThemeProvider>;
}
