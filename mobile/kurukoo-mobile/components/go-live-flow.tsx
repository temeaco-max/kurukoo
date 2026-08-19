import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { ActionButton, BrandMark, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";

const steps = ["Location consent", "Your broadcast", "Review"];

export function GoLiveFlow() {
  const colors = useColors();
  const [step, setStep] = useState(0);
  const [consented, setConsented] = useState(false);
  const [live, setLive] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("Need help with data analysis");
  const [broadcastDescription, setBroadcastDescription] = useState("Helping a small nonprofit analyze survey results for their community program.");

  useEffect(() => {
    AsyncStorage.getItem("kurukoo.nearby.broadcast-draft.v1").then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { title?: string; description?: string };
        if (parsed.title) setBroadcastTitle(parsed.title);
        if (parsed.description) setBroadcastDescription(parsed.description);
      } catch {
        // Fail closed to the canonical draft values.
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem("kurukoo.nearby.broadcast-draft.v1", JSON.stringify({ title: broadcastTitle, description: broadcastDescription }));
  }, [broadcastTitle, broadcastDescription]);

  const next = () => {
    haptic.light();
    if (step === 0 && !consented) return;
    if (step < 2) setStep((value) => value + 1);
    else setLive(true);
  };

  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Nearby Radar" title={live ? "Your opportunity is available" : "Go Live"} right={<Pressable accessibilityRole="button" accessibilityLabel="Close Go Live" onPress={() => router.back()} style={styles.closeButton}><Text style={[styles.closeText, { color: colors.primary }]}>Close</Text></Pressable>} />
        <Text style={[styles.subtitle, { color: colors.muted }]}>{live ? "People nearby can discover and respond." : "Share from your approximate area"}</Text>
        <View style={styles.stepper}>{steps.map((label, index) => <View key={label} style={styles.stepItem}><View style={[styles.stepCircle, { backgroundColor: index < step || live ? colors.success : index === step ? colors.primary : colors.surface, borderColor: index <= step || live ? colors.primary : colors.border }]}><Text style={[styles.stepNumber, { color: index <= step || live ? KURUKOO_VISUAL_TOKENS.onPrimary : colors.muted }]}>{index + 1}</Text></View><Text style={[styles.stepLabel, { color: index === step && !live ? colors.primary : colors.muted }]}>{label}</Text>{index < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: index < step || live ? colors.success : colors.border }]} /> : null}</View>)}</View>

        {!live && step === 0 ? <><SectionCard style={styles.heroCard}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Location consent</Text><Text style={[styles.body, { color: colors.muted }]}>We only use your approximate location to help nearby people discover your broadcast.</Text><View style={[styles.areaPanel, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}33` }]}><View style={[styles.areaDot, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}66` }]}><BrandMark compact /></View><View style={styles.areaCopy}><Text style={[styles.areaTitle, { color: colors.foreground }]}>Your approximate area</Text><Text style={[styles.body, { color: colors.muted }]}>Rounded to a neighborhood level{`\n`}Not your exact location{`\n`}You can change or stop sharing anytime</Text><Text style={[styles.link, { color: colors.primary }]}>Learn more</Text></View></View></SectionCard><SectionCard><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Consent</Text><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consented }} onPress={() => { haptic.selection(); setConsented((value) => !value); }} style={styles.checkRow}><View style={[styles.checkbox, { borderColor: consented ? colors.primary : colors.border, backgroundColor: consented ? `${colors.primary}18` : colors.surface }]}>{consented ? <IconSymbol name="checkmark" size={14} color={colors.primary} /> : null}</View><Text style={[styles.body, { color: colors.foreground }]}>I consent to share my approximate location for this broadcast. I can stop sharing anytime.</Text></Pressable><View style={[styles.lockRow, { borderTopColor: colors.border }]}><StatusPill label="Privacy boundary" tone="neutral" /><Text style={[styles.body, { color: colors.muted }]}>We do not collect background location. Location is used only for this broadcast.</Text></View></SectionCard></> : null}

        {!live && step === 1 ? <><SectionCard><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your broadcast</Text><Text style={[styles.body, { color: colors.muted }]}>Describe what you want nearby people to discover. Your name and organization will be shown as the source.</Text><View style={[styles.inputCard, { borderColor: colors.border }]}><Text style={[styles.inputLabel, { color: colors.muted }]}>What are you sharing?</Text><TextInput accessibilityLabel="Broadcast title" value={broadcastTitle} onChangeText={setBroadcastTitle} placeholder="Give your opportunity a title" placeholderTextColor={colors.muted} style={[styles.editableInput, { color: colors.foreground }]} /><TextInput accessibilityLabel="Broadcast description" value={broadcastDescription} onChangeText={setBroadcastDescription} placeholder="Describe what nearby people should discover" placeholderTextColor={colors.muted} multiline style={[styles.editableDescription, { color: colors.foreground, borderTopColor: colors.border }]} /><StatusPill label="Opportunity" tone="warning" /></View><View style={[styles.sourceRow, { borderColor: colors.border }]}><View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>AM</Text></View><View style={styles.sourceCopy}><Text style={[styles.sourceName, { color: colors.foreground }]}>Alex Morgan</Text><Text style={[styles.body, { color: colors.muted }]}>Alex Morgan Consulting</Text></View><Text style={[styles.sourceStateText, { color: colors.muted }]}>Source identity is fixed for this draft</Text></View></SectionCard></> : null}

        {!live && step === 2 ? <><SectionCard style={styles.liveCard}><View style={[styles.successIcon, { backgroundColor: `${colors.success}18` }]}><BrandMark compact /></View><Text style={[styles.liveTitle, { color: colors.foreground }]}>Review your broadcast</Text><Text style={[styles.body, { color: colors.muted }]}>Confirm the exact opportunity and the approximate area before making it visible.</Text><View style={styles.reviewCard}><View style={styles.reviewTop}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{broadcastTitle || "Untitled opportunity"}</Text><StatusPill label="Opportunity" tone="warning" /></View><Text style={[styles.body, { color: colors.muted }]}>{broadcastDescription || "No description added yet."}</Text><View style={[styles.detailLine, { borderTopColor: colors.border }]}><Text style={[styles.body, { color: colors.muted }]}>Approx. area</Text><Text style={[styles.bodyStrong, { color: colors.foreground }]}>Central District</Text></View><View style={styles.detailLine}><Text style={[styles.body, { color: colors.muted }]}>Source</Text><Text style={[styles.bodyStrong, { color: colors.foreground }]}>Alex Morgan</Text></View></View></SectionCard><View style={[styles.availableCard, { borderColor: colors.border }]}><StatusPill label="Available" tone="success" /><View style={styles.sourceCopy}><Text style={[styles.sourceName, { color: colors.foreground }]}>Available after review</Text><Text style={[styles.body, { color: colors.muted }]}>Visible to people in your approximate area</Text></View></View><SectionCard><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Not a Kurukoo provider yet?</Text><Text style={[styles.body, { color: colors.muted }]}>You can claim this opportunity to manage responses.</Text><ActionButton label="Continue in Chat" variant="secondary" onPress={() => router.replace("/(tabs)")} /></SectionCard></> : null}

        {live ? <><SectionCard style={styles.liveCard}><View style={[styles.successIcon, { backgroundColor: `${colors.success}18` }]}><BrandMark compact /></View><Text style={[styles.liveTitle, { color: colors.foreground }]}>Your opportunity is available</Text><Text style={[styles.body, { color: colors.muted }]}>People nearby can discover and respond. You can stop sharing at any time.</Text><StatusPill label="Available" tone="success" /></SectionCard><SectionCard><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lifecycle states</Text><View style={styles.lifecycle}><StatusPill label="Available" tone="success" /><StatusPill label="Claimed" tone="warning" /><StatusPill label="Verified" tone="neutral" /></View></SectionCard></> : null}

        <ActionButton label={live ? "Back to Nearby Radar" : step === 2 ? "Make opportunity available" : "Continue"} onPress={live ? () => router.back() : next} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 16 },
  closeButton: { minHeight: 44, minWidth: 60, alignItems: "flex-end", justifyContent: "center" },
  closeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  stepper: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 4 },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepNumber: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  stepLabel: { fontFamily: "Inter_500Medium", fontSize: 10, flexShrink: 1 },
  stepLine: { height: 1, flex: 1, minWidth: 8 },
  heroCard: { gap: 12 },
  sectionTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  body: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  bodyStrong: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  areaPanel: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 16, padding: 13 },
  areaDot: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  areaDotText: { fontSize: 30, lineHeight: 30 },
  areaCopy: { flex: 1, gap: 5 },
  areaTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  link: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  lock: { fontSize: 17 },
  inputCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, marginTop: 10 },
  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  inputValue: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  editableInput: { fontFamily: "Inter_600SemiBold", fontSize: 15, paddingVertical: 4 },
  editableDescription: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, borderTopWidth: 1, paddingTop: 8, minHeight: 58, textAlignVertical: "top" },
  sourceRow: { borderWidth: 1, borderRadius: 14, padding: 11, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: KURUKOO_VISUAL_TOKENS.onPrimary, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  sourceCopy: { flex: 1, gap: 2 },
  sourceName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  liveCard: { alignItems: "center", gap: 8 },
  successIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  successCheck: { fontSize: 28, fontWeight: "700" },
  liveTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 21 },
  reviewCard: { width: "100%", borderWidth: 1, borderColor: KURUKOO_VISUAL_TOKENS.border, borderRadius: 15, padding: 12, gap: 9, marginTop: 4 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  detailLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 8 },
  availableCard: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: "row", alignItems: "center", gap: 9 },
  availableDot: { fontSize: 20 },
  sourceStateText: { fontFamily: "Inter_400Regular", fontSize: 11, flexShrink: 1 },
  lifecycle: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  lifecycleText: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
