import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ActionButton, ContinuityBand, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { tasks } from "@/lib/kurukoo-data";
import { useColors } from "@/hooks/use-colors";
import { useKurukooContext } from "@/lib/kurukoo-context";
import { scheduleTaskContinuation } from "@/lib/notifications";

export default function TasksScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, setActiveTask, toggleTaskPaused } = useKurukooContext();
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  const remindMe = async (task: (typeof tasks)[number]) => {
    const notificationId = await scheduleTaskContinuation(task);
    setReminderStatus(notificationId ? `Reminder set for ${task.title}.` : "Local reminders are unavailable until notification permission is granted on a physical device.");
  };

  const openTaskInChat = (task: (typeof tasks)[number]) => {
    setActiveTask({ kind: "task", id: task.id, title: task.title });
    router.push("/(tabs)");
  };

  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Workspace" title="Tasks" right={<StatusPill label={`${tasks.length} active`} tone="warning" />} />
        <Text style={[styles.intro, { color: colors.muted }]}>Kurukoo keeps longer-running work here while your conversation stays available. You remain in control of every next step.</Text>
        {state.activeContext ? <ContinuityBand contextLabel={state.activeContext.kind === "task" ? "Task" : "Conversation"} contextId={state.activeContext.id} evidence="The active context is preserved when you return to Chat. Actions remain owner-scoped and policy-bound." action={<ActionButton label="Open active context" variant="ghost" onPress={() => router.push("/(tabs)")} />} /> : null}
        {tasks.map((task) => {
          const isPaused = state.pausedTaskIds.includes(task.id);
          const isActive = state.activeContext?.kind === "task" && state.activeContext.id === task.id;
          return (
            <SectionCard key={task.id}>
              <View style={styles.header}><View style={styles.copy}><Text style={[styles.kicker, { color: colors.primary }]}>{isPaused ? "Paused" : task.state}</Text><Text style={[styles.title, { color: colors.foreground }]}>{task.title}</Text></View><StatusPill label={isActive ? "In Chat" : isPaused ? "Paused" : "Running"} tone={isPaused ? "neutral" : "success"} /></View>
              <Text style={[styles.detail, { color: colors.muted }]}>{task.detail}</Text>
              <View style={styles.actions}><ActionButton label={isPaused ? "Resume" : "Pause"} variant="secondary" onPress={() => toggleTaskPaused(task.id)} /><ActionButton label="Open in Chat" variant="ghost" onPress={() => openTaskInChat(task)} /><ActionButton label="Remind me" variant="ghost" onPress={() => void remindMe(task)} /></View>
            </SectionCard>
          );
        })}
        {reminderStatus ? <Text accessibilityRole="alert" style={[styles.reminderStatus, { color: colors.muted }]}>{reminderStatus}</Text> : null}
        <SectionCard style={styles.safetyCard}><Text style={[styles.title, { color: colors.foreground }]}>Control stays with you</Text><Text style={[styles.detail, { color: colors.muted }]}>Agents can coordinate bounded work, but they cannot silently change a request, spend money or contact a provider without the required policy and confirmation state.</Text></SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  copy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  reminderStatus: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  safetyCard: { marginTop: 4 },
});
