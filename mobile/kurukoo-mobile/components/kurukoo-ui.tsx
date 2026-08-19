import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { KURUKOO_MARK_PATH, KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";

export { KURUKOO_MARK_PATH };

export function BrandMark({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.mark, compact && styles.markCompact]} testID="kurukoo-canonical-icon" accessibilityLabel="Kurukoo">
      <Image source={require("@/assets/images/kurukoo-logo.png")} resizeMode="contain" accessibilityLabel="Kurukoo" accessibilityRole="image" style={[styles.markImage, compact && styles.markImageCompact, inverse && styles.markImageInverse]} />
    </View>
  );
}

export function SurfaceHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function ContinuityBand({ contextLabel, contextId, evidence, action }: { contextLabel: string; contextId: string; evidence: string; action?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.continuityBand, { backgroundColor: `${colors.primary}0B`, borderColor: `${colors.primary}2B` }]} accessibilityLabel={`Context ${contextLabel} ${contextId}`}>
      <View style={styles.continuityBandTop}><Text style={[styles.continuityBandLabel, { color: colors.primary }]}>Context continuity</Text><StatusPill label="Preserved" tone="success" /></View>
      <Text style={[styles.continuityBandContext, { color: colors.foreground }]}>{contextLabel} · {contextId}</Text>
      <Text style={[styles.continuityBandEvidence, { color: colors.muted }]}>{evidence}</Text>
      {action ? <View style={styles.continuityBandAction}>{action}</View> : null}
    </View>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "error" }) {
  const colors = useColors();
  const toneColor = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "error" ? colors.error : colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: `${toneColor}18` }]}>
      <View style={[styles.pillDot, { backgroundColor: toneColor }]} />
      <Text style={[styles.pillText, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

export function ActionButton({ label, onPress, variant = "primary", style }: { label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost"; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  const backgroundColor = variant === "primary" ? colors.primary : variant === "secondary" ? colors.surface : "transparent";
  const textColor = variant === "primary" ? KURUKOO_VISUAL_TOKENS.onPrimary : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { haptic.light(); onPress(); }}
      style={({ pressed }) => [styles.actionButton, { backgroundColor, borderColor: colors.border }, variant === "ghost" && styles.ghostButton, pressed && styles.pressed, style]}
    >
      {variant === "primary" ? <BrandMark compact inverse /> : null}
      <Text style={[styles.actionText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function MessageBubble({ role, children }: { role: "agent" | "user"; children: React.ReactNode }) {
  const colors = useColors();
  const isUser = role === "user";
  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser ? <BrandMark compact /> : null}
      <View style={[styles.messageBubble, { backgroundColor: isUser ? colors.surface : "transparent", borderColor: colors.border }, isUser && styles.userBubble]}>
        <Text style={[styles.messageText, { color: colors.foreground }]}>{children}</Text>
      </View>
    </View>
  );
}

export function SectionCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  const colors = useColors();
  return <View style={styles.empty}><BrandMark /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  mark: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  markCompact: { width: 24, height: 24 },
  markImage: { width: 30, height: 30, borderRadius: 8 },
  markImageCompact: { width: 20, height: 20, borderRadius: 6 },
  markImageInverse: { tintColor: KURUKOO_VISUAL_TOKENS.inverseMark },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
  headerTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 27, lineHeight: 33 },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  actionButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ghostButton: { borderColor: "transparent", paddingHorizontal: 12 },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  messageRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 16 },
  messageRowUser: { justifyContent: "flex-end" },
  messageBubble: { maxWidth: "86%", paddingVertical: 2 },
  userBubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, borderTopRightRadius: 5, borderWidth: 1 },
  messageText: { fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 11, boxShadow: "0px 4px 12px rgba(36, 34, 31, 0.05)", elevation: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 20 },
  emptyDetail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 280 },
  continuityBand: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 6 },
  continuityBandTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  continuityBandLabel: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  continuityBandContext: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15, lineHeight: 20 },
  continuityBandEvidence: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  continuityBandAction: { marginTop: 3 },
});
