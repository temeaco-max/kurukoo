import type * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { buildTaskNotificationData, parseTaskNotificationData } from "@/lib/notification-contract";

export { buildTaskNotificationData, parseTaskNotificationData } from "@/lib/notification-contract";

export type NotificationReadiness =
  | { status: "web-unavailable"; detail: string }
  | { status: "permission-required"; detail: string }
  | { status: "project-id-required"; detail: string }
  | { status: "physical-device-required"; detail: string }
  | { status: "token-ready"; detail: string; token: string };

async function getNotificationsModule(): Promise<typeof import("expo-notifications")> {
  return import("expo-notifications");
}

export async function probeExpoPushToken(): Promise<NotificationReadiness> {
  if (Platform.OS === "web") return { status: "web-unavailable", detail: "Remote notification registration is unavailable on web." };
  const Notifications = await getNotificationsModule();
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return { status: "permission-required", detail: "Notification permission is not granted on this device." };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { status: "project-id-required", detail: "An EAS project identifier is required before a push token can be prepared." };
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return { status: "token-ready", detail: "A device token is available for backend registration; delivery is not yet claimed.", token };
  } catch {
    return { status: "physical-device-required", detail: "A physical device and development/release build are required to obtain a push token." };
  }
}

export async function configureLocalNotifications() {
  if (Platform.OS === "web") return;
  const Notifications = await getNotificationsModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifications = await getNotificationsModule();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("kurukoo-default", {
      name: "Kurukoo reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 160],
      lightColor: "#B95D3C",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function scheduleReminderOnDevice(reminder: { title: string; detail: string; date: string; time: string }): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const scheduledAt = new Date(`${reminder.date}T${reminder.time}:00`);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) return null;
  const permitted = await requestLocalNotificationPermission();
  if (!permitted) return null;
  const Notifications = await getNotificationsModule();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.detail,
      data: { kind: "reminder", reminderTitle: reminder.title },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: scheduledAt },
  });
}

export async function scheduleTaskContinuation(task: { id: string; title: string }, seconds = 60): Promise<string | null> {
  const permitted = await requestLocalNotificationPermission();
  if (!permitted) return null;
  const Notifications = await getNotificationsModule();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Continue with Kurukoo",
      body: task.title,
      data: buildTaskNotificationData(task),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(seconds)),
    },
  });
}
