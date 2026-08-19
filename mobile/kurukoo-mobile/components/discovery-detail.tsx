import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const providerStates = ["Discovered", "Candidate", "Invited", "Claimed", "Onboarded", "Verified"] as const;

const details = {
  "community-transport": { title: "Community transport update", source: "City Transport Office", description: "A source-attributed update shared for people in the approximate area.", distance: "~350 m", state: "Source attributed", stateTone: "success" as const, category: "Source" },
  "meal-support": { title: "Volunteer needed: Meal support", source: "Local Aid Network", description: "A community opportunity seeking a response from someone nearby.", distance: "~600 m", state: "Opportunity", stateTone: "warning" as const, category: "Opportunity" },
  "road-maintenance": { title: "Road maintenance notice", source: "Public Works Dept.", description: "A public notice shared by the named source for nearby discovery.", distance: "~750 m", state: "Source attributed", stateTone: "success" as const, category: "Source" },
  "graphic-designer": { title: "Looking for graphic designer", source: "Small Biz Collective", description: "A nearby request with an attributable source and no provider claim.", distance: "~1.1 km", state: "Opportunity", stateTone: "warning" as const, category: "Help request" },
  "community-workshop": { title: "Free community workshop", source: "Community Learning Hub", description: "A local event shared for discovery. Availability remains as shared by the source.", distance: "~1.3 km", state: "Source attributed", stateTone: "success" as const, category: "Source" },
} as const;

export function DiscoveryDetail() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const item = useMemo(() => details[id as keyof typeof details] ?? details["community-transport"], [id]);
  const [providerStep, setProviderStep] = useState(0);
  const nextProviderStep = () => setProviderStep((value) => Math.min(value + 1, providerStates.length - 1));

  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Nearby Radar" title="Discovery detail" right={<StatusPill label={item.state} tone={item.stateTone} />} />
        <Text style={[styles.subtitle, { color: colors.muted }]}>Approximate, source-attributed information shared for discovery.</Text>
        <SectionCard style={styles.hero}><Text style={[styles.category, { color: colors.primary }]}>{item.category}</Text><Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.description, { color: colors.muted }]}>{item.description}</Text><View style={styles.metaRow}><Text style={[styles.metaLabel, { color: colors.muted }]}>Approx. area</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>Central District · {item.distance}</Text></View></SectionCard>
        <SectionCard><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Source attribution</Text><StatusPill label="Named source" tone="success" /></View><Text style={[styles.description, { color: colors.muted }]}>The source is shown so you can evaluate where this information came from. Kurukoo does not turn a discovery entity into a provider without claim and verification evidence.</Text><View style={[styles.sourceRow, { borderColor: colors.border }]}><View style={[styles.avatar, { backgroundColor: colors.success }]}><Text style={styles.avatarText}>{item.source.slice(0, 2).toUpperCase()}</Text></View><View style={styles.sourceCopy}><Text style={[styles.sourceName, { color: colors.foreground }]}>{item.source}</Text><Text style={[styles.description, { color: colors.muted }]}>Source attribution · availability unconfirmed</Text></View></View></SectionCard>
        <View style={[styles.truthCard, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}44` }]}><Text style={[styles.truthTitle, { color: colors.foreground }]}>{providerStates[providerStep] === "Verified" ? "Verified Kurukoo provider" : "Not a Kurukoo provider yet"}</Text><Text style={[styles.description, { color: colors.muted }]}>{providerStates[providerStep] === "Verified" ? "Capability, identity and completion evidence are independently recorded for this provider." : "This result is discoverable but not claimed or verified. Any response or fulfilment remains pending independent evidence."}</Text></View>
        <SectionCard><View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Evidence timeline</Text><StatusPill label={providerStates[providerStep]} tone={providerStep === providerStates.length - 1 ? "success" : providerStep >= 3 ? "warning" : "neutral"} /></View>{providerStates.map((state, index) => <View key={state} style={styles.timelineRow}><View style={styles.timelineRail}><View style={[styles.timelineDot, { backgroundColor: index <= providerStep ? (index === providerStates.length - 1 ? colors.success : colors.primary) : colors.surface, borderColor: index <= providerStep ? colors.primary : colors.border }]} />{index < providerStates.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: index < providerStep ? colors.primary : colors.border }]} /> : null}</View><View style={styles.timelineCopy}><Text style={[styles.timelineTitle, { color: colors.foreground }]}>{state}</Text><Text style={[styles.description, { color: colors.muted }]}>{index === 0 ? "Entity was discovered near the approximate area." : index === 1 ? "Evidence suggests a candidate opportunity." : index === 2 ? "An invitation can be issued without claiming provider status." : index === 3 ? "The owner claimed the opportunity; fulfilment is still not verified." : index === 4 ? "Onboarding evidence is being reviewed." : "Identity and capability evidence are verified."}</Text></View></View>)}{providerStep < providerStates.length - 1 ? <ActionButton label={`Advance to ${providerStates[providerStep + 1]}`} variant="secondary" onPress={nextProviderStep} /> : null}</SectionCard>
        <SectionCard><Text style={[styles.sectionTitle, { color: colors.foreground }]}>What happens next?</Text><Text style={[styles.description, { color: colors.muted }]}>You can continue in Chat to ask Kurukoo about this item. No external contact or provider action is claimed from this screen.</Text><ActionButton label="Continue in Chat" onPress={() => router.replace("/(tabs)")} /></SectionCard>
        <ActionButton label="Back to Nearby Radar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 16 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  hero: { gap: 9 },
  category: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 24, lineHeight: 30 },
  description: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: KURUKOO_VISUAL_TOKENS.border, paddingTop: 11, marginTop: 4, gap: 8 },
  metaLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  metaValue: { flex: 1, textAlign: "right", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  sourceRow: { borderWidth: 1, borderRadius: 14, padding: 11, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: KURUKOO_VISUAL_TOKENS.onPrimary, fontFamily: "Inter_600SemiBold", fontSize: 11 },
  sourceCopy: { flex: 1, gap: 2 },
  sourceName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  truthCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 5 },
  truthTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16 },
  timelineRow: { flexDirection: "row", gap: 10, minHeight: 56 },
  timelineRail: { width: 18, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  timelineLine: { width: 1, flex: 1, minHeight: 18 },
  timelineCopy: { flex: 1, gap: 2 },
  timelineTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
