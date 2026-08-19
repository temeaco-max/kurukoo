import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { ActionButton, ContinuityBand, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const notifications = [
  { id: "1842", title: "Request not delivered", detail: "Permission did not allow the request to be delivered to Google Drive.", status: "Not delivered", tone: "warning" as const, action: "Retry" },
  { id: "1843", title: "Waiting for provider confirmation", detail: "The request is waiting for Google Drive.", status: "Waiting for provider confirmation", tone: "warning" as const },
  { id: "1841", title: "Request verified", detail: "The provider confirmed this request.", status: "Verified", tone: "success" as const },
  { id: "1840", title: "New request", detail: "A new request was created in Chat.", status: "Prepared", tone: "neutral" as const },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState("All");
  const [retried, setRetried] = useState<string | null>(null);
  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Notifications" title="Clear next steps" right={<StatusPill label="Not delivered with actions" tone="neutral" />} />
        <Text style={[styles.intro, { color: colors.muted }]}>Keep pending provider states visible and return to the originating Chat when you need more context.</Text>
        <ContinuityBand contextLabel="Notification stream" contextId="notifications" evidence="Each item preserves its canonical request or conversation relationship. Retry prepares the next step; it does not claim external delivery." action={<ActionButton label="Return to Chat" variant="ghost" onPress={() => router.replace("/(tabs)")} />} />
        <View style={styles.filters}>{["All", "Requests", "Reminders", "System"].map((item) => <ActionButton key={item} label={item} variant={filter === item ? "primary" : "ghost"} onPress={() => setFilter(item)} />)}</View>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Today</Text>
        {notifications.slice(0, 3).map((item) => <SectionCard key={item.id}><View style={styles.cardTop}><View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text></View><StatusPill label={retried === item.id ? "Retry prepared" : item.status} tone={retried === item.id ? "neutral" : item.tone} /></View><View style={styles.actions}><ActionButton label="Continue in Chat" variant="secondary" onPress={() => router.replace("/(tabs)")} />{item.action ? <ActionButton label={item.action} onPress={() => setRetried(item.id)} /> : null}</View></SectionCard>)}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Yesterday</Text>
        <SectionCard><View style={styles.cardTop}><View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{notifications[3].title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{notifications[3].detail}</Text></View><StatusPill label="Prepared" tone="neutral" /></View><ActionButton label="Continue in Chat" variant="secondary" onPress={() => router.replace("/(tabs)")} /></SectionCard>
        <ActionButton label="Notification settings" variant="ghost" onPress={() => router.push({ pathname: "/surface/[kind]", params: { kind: "connect" } })} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionLabel: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  copy: { flex: 1, gap: 5 },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
});
