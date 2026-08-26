// Kurukoo mobile More authority: account configuration and lower-frequency personal work only.
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { ActionButton, SectionCard, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type MoreItem = {
  title: string;
  detail: string;
  action: string;
  route?: "/surface/artifacts" | "/surface/notifications" | "/surface/reminders" | "/feature-compass";
  kind?: "connect" | "memory" | "safety" | "checkout";
};

const accountItems: MoreItem[] = [
  { title: "Notifications", detail: "Review updates and choose how Kurukoo can get your attention.", action: "Open notifications", route: "/surface/notifications" },
  { title: "Connections", detail: "Manage the channels and devices you choose to connect.", action: "Manage connections", kind: "connect" },
  { title: "Memory and privacy", detail: "Review the personal context you have chosen to keep available.", action: "Review privacy", kind: "memory" },
  { title: "Safety and check-ins", detail: "Manage trusted contacts and consent-bound check-ins.", action: "Open safety", kind: "safety" },
];

const continuityItems: MoreItem[] = [
  { title: "Reminders", detail: "Review follow-ups that are still useful to you.", action: "Open reminders", route: "/surface/reminders" },
  { title: "Activity and saved items", detail: "Review your saved voice notes, transcripts, and owned artifacts.", action: "Open activity", route: "/surface/artifacts" },
  { title: "Cart and checkout", detail: "Review sourced offers before any confirmation or payment step.", action: "Review cart", kind: "checkout" },
];

function openItem(item: MoreItem) {
  if (item.route) {
    router.push(item.route);
    return;
  }
  if (item.kind) router.push({ pathname: "/surface/[kind]", params: { kind: item.kind } });
}

function MoreItemCard({ item }: { item: MoreItem }) {
  const colors = useColors();
  return <SectionCard><Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text><ActionButton label={item.action} variant="ghost" onPress={() => openItem(item)} /></SectionCard>;
}

export default function MoreScreen() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Account" title="Settings and your Kurukoo" />
        <Text style={[styles.intro, { color: colors.muted }]}>Manage personal preferences and lower-frequency work without crowding the things you do most often.</Text>
        <View style={styles.group}><Text style={[styles.groupTitle, { color: colors.foreground }]}>Account and preferences</Text>{accountItems.map((item) => <MoreItemCard key={item.title} item={item} />)}</View>
        <View style={styles.group}><Text style={[styles.groupTitle, { color: colors.foreground }]}>Your continuity</Text>{continuityItems.map((item) => <MoreItemCard key={item.title} item={item} />)}</View>
        <SectionCard style={styles.exploreCard}><Text style={[styles.kicker, { color: colors.primary }]}>Explore</Text><Text style={[styles.title, { color: colors.foreground }]}>See what Kurukoo can help with</Text><Text style={[styles.detail, { color: colors.muted }]}>Browse capabilities when you are looking for a new way to use Kurukoo. This does not interrupt your current work.</Text><ActionButton label="Explore capabilities" variant="secondary" onPress={() => router.push("/feature-compass")} /></SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 18 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  group: { gap: 10 },
  groupTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, lineHeight: 24 },
  kicker: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { marginTop: 6, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  exploreCard: { gap: 2 },
});
