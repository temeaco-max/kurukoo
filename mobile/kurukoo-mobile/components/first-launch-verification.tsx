import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/kurukoo-ui";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { requestDeviceEmailVerification, verifyDeviceEmailCode } from "@/lib/device-verification-client";
import type { DeviceVerificationState } from "@/lib/device-verification";

export function FirstLaunchVerification({ onComplete }: { onComplete: (state: DeviceVerificationState) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("alex@example.com");
  const [code, setCode] = useState("");
  const [verificationStep, setVerificationStep] = useState<"request" | "code">("request");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const loadingPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!busy) {
      loadingPulse.stopAnimation();
      loadingPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(loadingPulse, { toValue: 0.62, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(loadingPulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [busy, loadingPulse]);

  const complete = (state: DeviceVerificationState) => {
    Animated.timing(screenOpacity, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => onComplete(state));
  };

  const requestVerification = async () => {
    if (!email.trim() || busy) return;
    haptic.light();
    setBusy(true);
    setStatus("Sending a secure verification request…");
    try {
      const message = await requestDeviceEmailVerification(email);
      setVerificationStep("code");
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Verification is unavailable. No link or code was claimed as delivered.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!email.trim() || code.trim().length < 4 || busy) return;
    haptic.light();
    setBusy(true);
    setStatus("Checking the verification code…");
    try {
      const message = await verifyDeviceEmailCode(email, code);
      setStatus(message);
      complete("verified");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The verification code could not be confirmed. This device remains unverified.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View style={[styles.screen, { backgroundColor: colors.background, opacity: screenOpacity }]}> 
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 24) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow} accessibilityLabel="First launch, step one of three">
          <View accessibilityLabel="First-launch verification" style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color={colors.foreground} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressStep, { backgroundColor: colors.primary }]} />
            <View style={[styles.progressStep, { backgroundColor: colors.border }]} />
            <View style={[styles.progressStep, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.progressSpacer} />
        </View>

        <View style={styles.hero}>
          <BrandMark />
          <Text style={[styles.wordmark, { color: colors.primary }]}>Kurukoo</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Let’s make sure{`\n`}this is your phone</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>We’ll send a secure verification link to confirm this device so you can access your conversations safely.</Text>
        </View>

        <View style={[styles.deviceIllustration, { borderColor: colors.muted }]}> 
          <View style={[styles.deviceSpeaker, { backgroundColor: colors.muted }]} />
          <View style={[styles.lockBadge, { backgroundColor: `${colors.primary}24` }]}>
            <MaterialIcons name="lock" size={38} color={colors.primary} />
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {verificationStep === "request" ? <View style={styles.emailRow}>
            <MaterialIcons name="mail-outline" size={22} color={colors.muted} />
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Verification email" style={[styles.emailInput, { color: colors.foreground }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Change verification email" onPress={() => setEmail("")}><Text style={[styles.changeText, { color: colors.primary }]}>Change</Text></Pressable>
          </View> : <View style={styles.emailRow}>
            <MaterialIcons name="lock-outline" size={22} color={colors.muted} />
            <TextInput value={code} onChangeText={setCode} autoCapitalize="none" keyboardType="number-pad" inputMode="numeric" maxLength={6} accessibilityLabel="Verification code" placeholder="Enter code" placeholderTextColor={colors.muted} style={[styles.emailInput, { color: colors.foreground }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Use a different email" onPress={() => { setVerificationStep("request"); setCode(""); setStatus(null); }}><Text style={[styles.changeText, { color: colors.primary }]}>Change</Text></Pressable>
          </View>}
          <Pressable accessibilityRole="button" accessibilityLabel={verificationStep === "request" ? "Request device verification" : "Verify this device"} disabled={busy || (verificationStep === "request" ? !email.trim() : code.trim().length < 4)} onPress={() => void (verificationStep === "request" ? requestVerification() : verifyCode())} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, (busy || (verificationStep === "request" ? !email.trim() : code.trim().length < 4)) && styles.disabled, pressed && styles.pressed]}>
            {busy ? <Animated.View style={{ opacity: loadingPulse }}><ActivityIndicator color={KURUKOO_VISUAL_TOKENS.onPrimary} /></Animated.View> : <Text style={styles.primaryText}>{verificationStep === "request" ? "Verify this device" : "Confirm code"}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Continue without provider status" onPress={() => { haptic.light(); complete("not-provider"); }} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.background, borderColor: colors.border }, pressed && styles.pressed]}>
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>Not a Kurukoo provider yet</Text>
          </Pressable>
        </View>

        {status ? <View style={[styles.statusCard, { backgroundColor: `${colors.warning}14`, borderColor: `${colors.warning}40` }]} accessibilityRole="alert"><MaterialIcons name="info-outline" size={18} color={colors.warning} /><Text style={[styles.statusText, { color: colors.foreground }]}>{status}</Text></View> : null}
        <Text style={[styles.privacy, { color: colors.muted }]}>We never share your information.</Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 24 },
  progressRow: { width: "100%", flexDirection: "row", alignItems: "center", minHeight: 44 },
  backButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  progressTrack: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 34 },
  progressStep: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: KURUKOO_VISUAL_TOKENS.border },
  progressSpacer: { width: 44 },
  hero: { alignItems: "center", marginTop: 32 },
  wordmark: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 23, marginTop: -4 },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 30, lineHeight: 36, textAlign: "center", marginTop: 34 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 310, marginTop: 14 },
  deviceIllustration: { width: 92, height: 174, borderWidth: 2, borderRadius: 18, marginTop: 28, alignItems: "center", justifyContent: "center" },
  deviceSpeaker: { width: 26, height: 3, borderRadius: 2, position: "absolute", top: 10 },
  lockBadge: { width: 76, height: 78, borderRadius: 16, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-4deg" }] },
  formCard: { width: "100%", maxWidth: 430, borderWidth: 1, borderRadius: 17, padding: 10, marginTop: 30, gap: 10 },
  emailRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  emailInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  changeText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  primaryButton: { minHeight: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  primaryText: { color: KURUKOO_VISUAL_TOKENS.onPrimary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  secondaryButton: { minHeight: 50, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  statusCard: { width: "100%", maxWidth: 430, flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  statusText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  privacy: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 18 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
