export type NotificationReadinessStatus = "web-unavailable" | "permission-required" | "project-id-required" | "physical-device-required" | "token-ready";

export function notificationReadinessLabel(status: NotificationReadinessStatus): string {
  switch (status) {
    case "token-ready": return "Device token ready for backend registration; delivery is not claimed.";
    case "permission-required": return "Notification permission is not granted on this device.";
    case "project-id-required": return "An EAS project identifier is required before push registration can be prepared.";
    case "physical-device-required": return "A physical device and development/release build are required for push-token preparation.";
    case "web-unavailable": return "Remote notification registration is unavailable on web.";
  }
}

export type TaskNotificationData = {
  kind: "task-continuation";
  taskId: string;
  taskTitle: string;
  url: "/(tabs)";
};

export function buildTaskNotificationData(task: { id: string; title: string }): TaskNotificationData {
  return { kind: "task-continuation", taskId: task.id, taskTitle: task.title, url: "/(tabs)" };
}

export function parseTaskNotificationData(value: unknown): TaskNotificationData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<TaskNotificationData>;
  if (data.kind !== "task-continuation" || typeof data.taskId !== "string" || typeof data.taskTitle !== "string" || data.url !== "/(tabs)") return null;
  return { kind: data.kind, taskId: data.taskId, taskTitle: data.taskTitle, url: data.url };
}
