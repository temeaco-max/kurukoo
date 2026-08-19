import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type ConnectItem = { title: string; detail: string; state: string; tone: "neutral" | "success" | "warning"; action?: string; route?: string };

const items: { heading: string; entries: ConnectItem[] }[] = [
  {
    heading: "Storage",
    entries: [
      { title: "Google Drive", detail: "Your connected user-owned storage is the preferred home for durable Kurukoo artifacts. OAuth remains deployment-controlled until configured.", state: "Setup pending", tone: "warning", action: "Open artifacts", route: "/surface/artifacts" },
    ],
  },
  {
    heading: "Communication",
    entries: [
      { title: "WhatsApp & Telegram", detail: "Linked-channel readiness is managed by the canonical Connect/backend lifecycle. Pairing and revocation require real provider evidence.", state: "Provider gated", tone: "warning", action: "Open channels", route: "/surface/go-live" },
      { title: "Voice & notifications", detail: "Voice, push and reminder surfaces use the same identity, conversation and artifact contracts as the Web App.", state: "Implemented", tone: "success", action: "Open notifications", route: "/surface/notifications" },
    ],
  },
  {
    heading: "Capabilities & devices",
    entries: [
      { title: "Capability Portfolio", detail: "Switch among the capabilities you use—provider, contributor, delivery, buyer, seller and other roles without creating separate identities.", state: "Implemented", tone: "success", action: "Open capabilities", route: "/surface/capabilities" },
      { title: "Go Live", detail: "Control your presence and readiness for work through the canonical Pulse/capability boundary.", state: "Implemented", tone: "success", action: "Open Go Live", route: "/surface/go-live" },
    ],
  },
];

export default function ConnectTab() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Connect" title="Bring Kurukoo together" right={<StatusPill label="One OS" tone="success" />} />
        <Text style={[styles.intro, { color: colors.muted }]}>Connect storage, communication channels, devices and capabilities without creating parallel accounts or state.</Text>
        {items.map((group) => (
          <View key={group.heading} style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.foreground }]}>{group.heading}</Text>
            {group.entries.map((entry) => (
              <SectionCard key={entry.title}>
                <View style={styles.header}>
                  <View style={styles.copy}>
                    <Text style={[styles.title, { color: colors.foreground }]}>{entry.title}</Text>
                    <Text style={[styles.detail, { color: colors.muted }]}>{entry.detail}</Text>
                  </View>
                  <StatusPill label={entry.state} tone={entry.tone} />
                </View>
                {entry.action && entry.route ? <ActionButton label={entry.action} variant="secondary" onPress={() => router.push(entry.route as never)} /> : null}
              </SectionCard>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 20 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  group: { gap: 10 },
  groupTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  copy: { flex: 1, gap: 5 },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
});
