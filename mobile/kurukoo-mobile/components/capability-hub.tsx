import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { OS_ARTIFACTS, OS_CAPABILITY_SKILLS, OS_OPPORTUNITIES } from "@/lib/os-capability-contract";
import { trpc } from "@/lib/trpc";
import { VoiceNoteCapture } from "@/components/voice-note-capture";

export function CapabilityHub() {
  const colors = useColors();
  const router = useRouter();
  const [agentPaused, setAgentPaused] = useState(false);
  const [activeSkill, setActiveSkill] = useState("Planning");
  const portfolio = trpc.os.portfolio.useQuery(undefined, { retry: false });
  const serviceData = portfolio.data;
  const serviceUnavailable = portfolio.isError;
  const skills = serviceData?.skills ?? OS_CAPABILITY_SKILLS;
  const artifacts = serviceData?.artifacts ?? OS_ARTIFACTS;
  const opportunities = serviceData?.opportunities ?? OS_OPPORTUNITIES;

  return (
    <ScreenContainer testID="native-capability-portfolio" accessibilityLabel={`Capability Portfolio · ${serviceUnavailable ? "unavailable" : portfolio.isLoading ? "loading" : agentPaused ? "paused" : "ready"}`} className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Capability Portfolio" title="One person, many useful skills" right={<StatusPill label="Chat is the home" tone="success" />} />
        <Text style={[styles.intro, { color: colors.muted }]}>Kurukoo keeps your identity, capabilities, agents and evidence connected. Choose a capability here, then continue the same context in Chat.</Text>{portfolio.isLoading ? <Text style={[styles.detail, { color: colors.muted }]}>Refreshing capability evidence…</Text> : serviceUnavailable ? <Text style={[styles.detail, { color: colors.warning }]}>Live capability evidence is unavailable. Existing local context is shown without claiming a fresh sync.</Text> : null}

        <SectionCard style={styles.identityCard}>
          <View style={styles.identityTop}><View style={[styles.avatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` }]}><Text style={[styles.avatarText, { color: colors.primary }]}>AM</Text></View><View style={styles.identityCopy}><Text style={[styles.identityName, { color: colors.foreground }]}>Alex Morgan</Text><Text style={[styles.detail, { color: colors.muted }]}>Multi-skilled person · profile evidence stays yours</Text></View><StatusPill label="Profile ready" tone="success" /></View>
          <View style={[styles.identityMeta, { borderTopColor: colors.border }]}><Text style={[styles.metaText, { color: colors.muted }]}>{skills.length} capabilities</Text><Text style={[styles.metaText, { color: colors.muted }]}>{artifacts.length} artifacts</Text><Text style={[styles.metaText, { color: colors.muted }]}>{serviceData?.storage.state === "connected" ? "Connected storage" : "Storage status unknown"}</Text></View>
        </SectionCard>

        <SectionCard>
          <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Capability Pulse</Text><Text style={[styles.detail, { color: colors.muted }]}>Skill-specific readiness, not a generic score.</Text></View><StatusPill label="Live" tone="success" /></View>
          {skills.map((skill) => <View key={skill.name} style={[styles.skillRow, activeSkill === skill.name && { borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}08` }]}><View style={styles.skillCopy}><Text style={[styles.skillName, { color: colors.foreground }]}>{skill.name}</Text><Text style={[styles.detail, { color: colors.muted }]}>{skill.detail}</Text></View><StatusPill label={skill.pulse} tone={skill.tone} /><ActionButton label={activeSkill === skill.name ? "Selected" : "View"} variant="ghost" onPress={() => setActiveSkill(skill.name)} /></View>)}
        </SectionCard>

        <SectionCard>
          <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Agents at your control</Text><Text style={[styles.detail, { color: colors.muted }]}>Bounded agents continue only when their state allows it.</Text></View><StatusPill label={agentPaused ? "Paused" : "Running"} tone={agentPaused ? "neutral" : "success"} /></View>
          <View style={[styles.agentRow, { borderColor: colors.border }]}><View style={[styles.agentMark, { backgroundColor: `${colors.primary}18` }]}><Text style={{ color: colors.primary, fontSize: 18 }}>✦</Text></View><View style={styles.skillCopy}><Text style={[styles.skillName, { color: colors.foreground }]}>Prayer Agent</Text><Text style={[styles.detail, { color: colors.muted }]}>Private reflection, prayer and check-in prompts. No external action is claimed.</Text></View></View>
          <View style={styles.actionRow}><ActionButton label={agentPaused ? "Resume agent" : "Pause agent"} variant="secondary" onPress={() => setAgentPaused((value) => !value)} /><ActionButton label="Continue in Chat" onPress={() => router.replace("/(tabs)")} /></View>
        </SectionCard>

        <SectionCard>
          <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Voice & connected storage</Text><Text style={[styles.detail, { color: colors.muted }]}>Voice is ready for review; storage state stays explicit.</Text></View><StatusPill label="Not recording" tone="neutral" /></View>
          <View style={styles.statusList}><View style={[styles.statusRow, { borderBottomColor: colors.border }]}><Text style={[styles.skillName, { color: colors.foreground }]}>Voice input</Text><Text style={[styles.detail, { color: colors.muted }]}>Available on device · review before sending</Text></View><View style={[styles.statusRow, { borderBottomColor: colors.border }]}><Text style={[styles.skillName, { color: colors.foreground }]}>Connected storage</Text><Text style={[styles.detail, { color: colors.muted }]}>2 sources connected · sync state visible</Text></View><View style={styles.statusRow}><Text style={[styles.skillName, { color: colors.foreground }]}>Proactive notifications</Text><Text style={[styles.detail, { color: colors.muted }]}>4 updates · delivery is not claimed until configured</Text></View></View>
        </SectionCard>

        <VoiceNoteCapture onTranscript={() => undefined} />

        <SectionCard>
          <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Opportunities & network</Text><Text style={[styles.detail, { color: colors.muted }]}>Discover, respond and verify without leaving the shared context.</Text></View><StatusPill label="2 nearby" tone="warning" /></View>
          {opportunities.map((item) => <View key={item.title} style={[styles.opportunity, { borderColor: colors.border }]}><View style={styles.skillCopy}><Text style={[styles.skillName, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text></View><StatusPill label={item.state} tone={item.state === "Opportunity" ? "warning" : "neutral"} /></View>)}
          <ActionButton label="Open Nearby Radar" variant="secondary" onPress={() => router.push("/(tabs)/discover")} />
        </SectionCard>

        <SectionCard>
          <View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Artifacts</Text><Text style={[styles.detail, { color: colors.muted }]}>Outputs remain inspectable, editable and attributable.</Text></View><StatusPill label="3 saved" tone="success" /></View>
          {artifacts.map((artifact) => <View key={artifact.title} style={[styles.artifactRow, { borderBottomColor: colors.border }]}><View style={styles.skillCopy}><Text style={[styles.skillName, { color: colors.foreground }]}>{artifact.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{artifact.detail}</Text></View><StatusPill label={artifact.state} tone={artifact.state === "Saved" ? "success" : artifact.state === "Draft" ? "neutral" : "warning"} /></View>)}
          <View style={[styles.modelNote, { backgroundColor: `${KURUKOO_VISUAL_TOKENS.info}10`, borderColor: `${KURUKOO_VISUAL_TOKENS.info}44` }]}><Text style={[styles.detail, { color: colors.foreground }]}>Teacher/model status: Kurukoo is ready to help with this context; no model handoff is presented as completed.</Text></View>
        </SectionCard>

        <ActionButton label="Continue in Chat" onPress={() => router.replace("/(tabs)")} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  identityCard: { gap: 14 },
  identityTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  identityCopy: { flex: 1, gap: 2 },
  identityName: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18 },
  identityMeta: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 12 },
  metaText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  sectionTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "transparent", borderRadius: 13, padding: 10 },
  skillCopy: { flex: 1, gap: 2 },
  skillName: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  agentRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 11 },
  agentMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionRow: { flexDirection: "row", gap: 9, marginTop: 10 },
  statusList: { gap: 0 },
  statusRow: { paddingVertical: 10, borderBottomWidth: 1, gap: 2 },
  opportunity: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 13, padding: 11, marginBottom: 9 },
  artifactRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  modelNote: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 12 },
});
