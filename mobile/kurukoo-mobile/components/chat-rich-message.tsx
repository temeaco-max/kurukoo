import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";

import { useColors } from "@/hooks/use-colors";
import { BrandMark } from "@/components/kurukoo-ui";

export function ChatRichMessage({
  content,
  role,
  copied,
  onCopy,
  onRegenerate,
  onEdit,
  feedback,
  onFeedback,
  feedbackSaving,
}: {
  content: string;
  role: "user" | "assistant";
  copied: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  feedback?: "up" | "down";
  onFeedback?: (value: "up" | "down") => void;
  feedbackSaving?: boolean;
}) {
  const colors = useColors();
  const feedbackScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!feedback) return;
    Animated.sequence([
      Animated.timing(feedbackScale, { toValue: 1.12, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(feedbackScale, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [feedback, feedbackScale]);
  const blocks = content.split(/```([\w-]*)\n?([\s\S]*?)```/g);
  const body: React.ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const value = blocks[index] ?? "";
    if (index % 3 === 1) continue;
    if (index % 3 === 2) {
      const language = blocks[index - 1] || "code";
      body.push(
        <View key={`code-${index}`} style={[styles.codeBlock, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.codeLanguage, { color: colors.surface }]}>{language}</Text>
          <Text style={[styles.codeText, { color: colors.surface }]}>{highlightCode(value.trimEnd())}</Text>
        </View>,
      );
      continue;
    }
    const paragraphs = value.split(/\n\s*\n/).filter(Boolean);
    paragraphs.forEach((paragraph, paragraphIndex) => {
      body.push(
        <Text key={`paragraph-${index}-${paragraphIndex}`} style={[styles.body, { color: role === "user" ? colors.surface : colors.foreground }]}>
          {renderInlineMarkdown(paragraph)}
        </Text>,
      );
    });
  }

  return (
    <View style={[styles.row, role === "user" && styles.userRow]}>
      {role === "assistant" ? <BrandMark compact /> : null}
      <View style={[styles.bubble, role === "user" ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {body}
        <View style={styles.actionsRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={copied ? "Message copied" : "Copy message"} onPress={onCopy} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}><Text style={[styles.copyText, { color: role === "user" ? `${colors.surface}CC` : colors.muted }]}>{copied ? "Copied" : "Copy"}</Text></Pressable>
          {onRegenerate ? <Pressable accessibilityRole="button" accessibilityLabel="Regenerate response" onPress={onRegenerate} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}><Text style={[styles.copyText, { color: colors.muted }]}>Regenerate</Text></Pressable> : null}
          {onEdit ? <Pressable accessibilityRole="button" accessibilityLabel="Edit prompt" onPress={onEdit} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}><Text style={[styles.copyText, { color: colors.muted }]}>Edit</Text></Pressable> : null}
          {onFeedback ? <View style={styles.feedbackGroup}><Animated.View style={{ transform: [{ scale: feedbackScale }] }}><Pressable accessibilityRole="button" accessibilityLabel={feedbackSaving ? "Saving response rating" : "Helpful response"} accessibilityHint="Rate whether Kurukoo's response helped you" accessibilityState={{ selected: feedback === "up", busy: feedbackSaving }} disabled={feedbackSaving} onPress={() => onFeedback("up")} style={({ pressed }) => [styles.iconButton, feedback === "up" && styles.selected, pressed && styles.pressed]}><MaterialIcons name="thumb-up" size={15} color={feedback === "up" ? colors.primary : colors.muted} /></Pressable></Animated.View><Animated.View style={{ transform: [{ scale: feedbackScale }] }}><Pressable accessibilityRole="button" accessibilityLabel={feedbackSaving ? "Saving response rating" : "Not helpful response"} accessibilityHint="Tell Kurukoo this response needs improvement" accessibilityState={{ selected: feedback === "down", busy: feedbackSaving }} disabled={feedbackSaving} onPress={() => onFeedback("down")} style={({ pressed }) => [styles.iconButton, feedback === "down" && styles.selected, pressed && styles.pressed]}><MaterialIcons name="thumb-down" size={15} color={feedback === "down" ? colors.primary : colors.muted} /></Pressable></Animated.View></View> : null}
        </View>
      </View>
    </View>
  );
}

function renderInlineMarkdown(value: string): React.ReactNode[] {
  const tokens = value.split(/(\*\*[^*]+\*\*|`[^`]+`|^#{1,3}\s+[^\n]+$|^[-*]\s+[^\n]+$)/gm);
  return tokens.filter(Boolean).map((token, index) => {
    if (/^#{1,3}\s+/.test(token)) return <Text key={index} style={styles.heading}>{token.replace(/^#{1,3}\s+/, "")}</Text>;
    if (/^[-*]\s+/.test(token)) return <Text key={index} style={styles.listItem}>• {token.replace(/^[-*]\s+/, "")}</Text>;
    if (/^\*\*[^*]+\*\*$/.test(token)) return <Text key={index} style={styles.bold}>{token.slice(2, -2)}</Text>;
    if (/^`[^`]+`$/.test(token)) return <Text key={index} style={styles.inlineCode}>{token.slice(1, -1)}</Text>;
    return <Text key={index}>{token}</Text>;
  });
}

function highlightCode(value: string): React.ReactNode[] {
  const tokens = value.split(/(\/\/[^\n]*|#[^\n]*|\b(?:const|let|var|function|return|if|else|for|while|import|from|export|class|async|await|true|false|null)\b|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)/g);
  return tokens.filter(Boolean).map((token, index) => {
    const isComment = /^(\/\/|#)/.test(token);
    const isKeyword = /^(const|let|var|function|return|if|else|for|while|import|from|export|class|async|await|true|false|null)$/.test(token);
    const isString = /^("|'|`)/.test(token);
    return <Text key={index} style={{ color: isComment ? "#A7D6A1" : isKeyword ? "#F4C27A" : isString ? "#F3A6A6" : "#F7F2EC" }}>{token}</Text>;
  });
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  userRow: { justifyContent: "flex-end" },
  bubble: { maxWidth: "88%", borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, gap: 9 },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  heading: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  bold: { fontFamily: "Inter_700Bold" },
  listItem: { marginBottom: 3 },
  inlineCode: { fontFamily: "SpaceGrotesk_500Medium", backgroundColor: KURUKOO_VISUAL_TOKENS.border, paddingHorizontal: 3 },
  codeBlock: { borderRadius: 10, padding: 10, gap: 6, minWidth: 230 },
  codeLanguage: { fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase", opacity: 0.7 },
  codeText: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 12, lineHeight: 18 },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 4, minHeight: 32 },
  copyButton: { minHeight: 32, justifyContent: "center", paddingHorizontal: 7, borderRadius: 8 },
  copyText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  feedbackGroup: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 2 },
  iconButton: { minWidth: 30, minHeight: 30, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  selected: { backgroundColor: `${KURUKOO_VISUAL_TOKENS.primary}14` },
  pressed: { opacity: 0.65 },
});
