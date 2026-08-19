import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const links = [
  { title: "Capability Portfolio", detail: "Your multi-skill identity, Pulse, agents, voice and artifacts", state: "Ready", route: "/surface/capabilities" },
  { title: "Artifact history", detail: "Play voice notes, review transcripts, and inspect storage ownership", state: "Available", route: "/surface/artifacts" },
  { title: "Notifications", detail: "Review pending, verified and not-delivered outcomes", state: "4 updates", route: "/surface/notifications" },
  { title: "Requests", detail: "Review active, waiting and completed work with evidence", state: "3 items", route: "/surface/requests" },
  { title: "Reminders", detail: "Edit, pause and continue saved conversation context", state: "3 items", route: "/surface/reminders" },
  { title: "Connect channels", detail: "WhatsApp, Telegram, email and other access points", state: "Ready for activation", kind: "connect" },
  { title: "Memory and privacy", detail: "Review provenance-backed memories and revoke context", state: "In your control", kind: "memory" },
  { title: "Safety and check-ins", detail: "Protective interruptions, trusted contacts and check-ins", state: "Available", kind: "safety" },
  { title: "Cart and checkout", detail: "Review sourced offers and confirm before payment", state: "Protected", kind: "checkout" },
  { title: "Partners workspace", detail: "Review opportunity coordination, trust and evidence", state: "Candidate network", kind: "partners" },
  { title: "Agents workspace", detail: "Review bounded goals, tool policy and pause controls", state: "Policy governed", kind: "agents" },
  { title: "Admin operations", detail: "Review activation prerequisites, evidence and policy controls", state: "Needs activation", kind: "admin" },
];

export default function MoreScreen() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Your Kurukoo" title="Everything stays connected" right={<StatusPill label="Available" tone="success" />} />
        <Text style={[styles.intro, { color: colors.muted }]}>Your conversations, reminders and saved context stay connected to your profile. Choose a surface without leaving the operating system.</Text>
        {links.map((item) => (
          <SectionCard key={item.title}>
            <View style={styles.header}><View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text></View><StatusPill label={item.state} tone={item.state === "Available" ? "success" : "neutral"} /></View>
            <ActionButton label="Open surface" variant="ghost" onPress={() => { if ("route" in item) { router.push(item.route as "/surface/capabilities" | "/surface/artifacts" | "/surface/requests" | "/surface/reminders" | "/surface/notifications"); } else if (item.kind) { router.push({ pathname: "/surface/[kind]", params: { kind: item.kind } }); } }} />
          </SectionCard>
        ))}
        <SectionCard style={styles.checkoutCard}><Text style={[styles.kicker, { color: colors.primary }]}>Checkout promise</Text><Text style={[styles.title, { color: colors.foreground }]}>No hidden handoffs</Text><Text style={[styles.detail, { color: colors.muted }]}>Kurukoo shows the offer, source, price state, confirmation step and external payment boundary before anything proceeds.</Text><ActionButton label="Review a demo offer" onPress={() => router.push({ pathname: "/surface/[kind]", params: { kind: "confirmation" } })} /></SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  copy: { flex: 1, gap: 6 },
  kicker: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  checkoutCard: { marginTop: 4 },
});
