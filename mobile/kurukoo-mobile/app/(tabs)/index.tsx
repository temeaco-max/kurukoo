// Kurukoo native Chat authority: conversation-first hierarchy, shared evidence states, and touch-safe composer controls.
import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";

import { ActionButton, BrandMark, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ChatRichMessage } from "@/components/chat-rich-message";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { useKurukooContext } from "@/lib/kurukoo-context";
import { loadChatFeedback, loadChatMessages, saveChatFeedback, streamChatMessage, type ChatMessage } from "@/lib/chat-client";
import { VoiceNoteCapture } from "@/components/voice-note-capture";
import { IconSymbol } from "@/components/ui/icon-symbol";

const composerExamples = ["Get me a taxi", "How do I earn on Kurukoo?", "Remind me to call Mum at 8", "Where is the nearest football team I can join?", "How can I become a contributor?", "Help me grow my business"];

// Canonical state contract: "loading" | "ready" | "empty"; error is an explicit unavailable extension.
type ConversationStatus = "loading" | "ready" | "empty" | "error";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state: contextState, clearActiveContext } = useKurukooContext();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>("loading");
  const [conversationError, setConversationError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [firstToken, setFirstToken] = useState(false);
  const [readReceipt, setReadReceipt] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | undefined>();
  const [editingId, setEditingId] = useState<string | number | undefined>();
  const [feedbackById, setFeedbackById] = useState<Record<string, "up" | "down">>({});
  const [feedbackSavingById, setFeedbackSavingById] = useState<Record<string, boolean>>({});
  const [feedbackStatus, setFeedbackStatus] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);
  const followLatest = useRef(true);
  const abortController = useRef<AbortController | null>(null);
  const lastPrompt = useRef("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderCharacters, setPlaceholderCharacters] = useState(0);
  const [showVoiceCapture, setShowVoiceCapture] = useState(false);
  const activeTask = contextState.activeContext?.kind === "task" ? contextState.activeContext : null;

  useEffect(() => {
    let active = true;
    setConversationStatus("loading");
    loadChatMessages().then((result) => {
      if (!active) return;
      setMessages(result.messages);
      setConversationId(result.conversationId);
      setConversationStatus(result.messages.length ? "ready" : "empty");
      loadChatFeedback(result.messages.filter((item) => item.role === "assistant").map((item) => item.id)).then((saved) => { if (active) setFeedbackById(saved); }).catch(() => { if (active) setFeedbackStatus("Saved response ratings could not be restored."); });
    }).catch((error) => {
      if (!active) return;
      setConversationStatus("error");
      setConversationError(error instanceof Error ? error.message : "The conversation could not be restored.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (followLatest.current) scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, typing]);

  useEffect(() => {
    if (draft || sending) return;
    const example = composerExamples[placeholderIndex];
    const complete = placeholderCharacters >= example.length;
    const timer = setTimeout(() => {
      if (complete) { setPlaceholderIndex((current) => (current + 1) % composerExamples.length); setPlaceholderCharacters(0); }
      else setPlaceholderCharacters((current) => current + 1);
    }, complete ? 2200 : 28);
    return () => clearTimeout(timer);
  }, [draft, sending, placeholderCharacters, placeholderIndex]);

  const copyMessage = async (message: ChatMessage) => {
    await Clipboard.setStringAsync(message.content);
    setCopiedMessageId(message.id);
    setTimeout(() => setCopiedMessageId((current) => current === message.id ? undefined : current), 1800);
  };

  const clearConversation = () => {
    abortController.current?.abort();
    abortController.current = null;
    setMessages([]);
    setConversationId(undefined);
    setConversationStatus("empty");
    setConversationError(undefined);
    setEditingId(undefined);
    setFeedbackById({});
    setFeedbackSavingById({});
    setFeedbackStatus(undefined);
    setDraft("");
  };

  const recordFeedback = async (messageId: string | number, value: "up" | "down") => {
    const key = String(messageId);
    const persistedId = Number(messageId);
    const previous = feedbackById[key];
    setFeedbackById((current) => ({ ...current, [key]: value }));
    setFeedbackStatus(undefined);
    if (!Number.isSafeInteger(persistedId) || persistedId <= 0) { setFeedbackStatus("This response is still being saved. Try rating it again in a moment."); return; }
    setFeedbackSavingById((current) => ({ ...current, [key]: true }));
    try {
      await saveChatFeedback(persistedId, value);
      setFeedbackStatus(value === "up" ? "Thanks — rating saved." : "Thanks — feedback saved.");
    } catch {
      setFeedbackById((current) => { const next = { ...current }; if (previous) next[key] = previous; else delete next[key]; return next; });
      setFeedbackStatus("Feedback could not be saved. Your previous rating was kept.");
    } finally {
      setFeedbackSavingById((current) => { const next = { ...current }; delete next[key]; return next; });
    }
  };

  const stopGenerating = () => {
    abortController.current?.abort();
    abortController.current = null;
  };

  const ask = async (value = draft, regenerate = false) => {
    const message = value.trim();
    if (!message || sending) return;
    haptic.light();
    lastPrompt.current = message;
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() };
    const streamId = `assistant-stream-${Date.now()}`;
    let persistedAssistantId: number | string | undefined;
    setMessages((current) => {
      if (regenerate) return [...current.slice(0, -1), { id: streamId, role: "assistant", content: "", createdAt: new Date().toISOString() }];
      if (editingId !== undefined) {
        const editedIndex = current.findIndex((item) => item.id === editingId);
        if (editedIndex >= 0) return [...current.slice(0, editedIndex), optimistic, { id: streamId, role: "assistant", content: "", createdAt: new Date().toISOString() }];
      }
      return [...current, optimistic, { id: streamId, role: "assistant", content: "", createdAt: new Date().toISOString() }];
    });
    setEditingId(undefined);
    setConversationStatus("ready");
    setDraft("");
    setSending(true);
    setTyping(true);
    setFirstToken(false);
    setReadReceipt(false);
    abortController.current = new AbortController();
    setConversationError(undefined);
    try {
      const result = await streamChatMessage({
        message,
        conversationId,
        contextAction: activeTask ? {
          type: "resume_canonical_context",
          contextId: `task:${activeTask.id}`,
          objectType: "task",
          objectId: activeTask.id,
          canonicalAction: "task.continue",
        } : undefined,
          onEvent: (event) => {
          const eventRecord = event as Record<string, unknown>;
          if (event.type === "conversation" && typeof eventRecord.conversationId === "string") setConversationId(eventRecord.conversationId);
          if ((event.type === "conversation" || event.type === "done") && (typeof eventRecord.assistantMessageId === "number" || typeof eventRecord.assistantMessageId === "string")) persistedAssistantId = eventRecord.assistantMessageId;
          if (event.type === "delta" && typeof eventRecord.text === "string") { setFirstToken(true); setMessages((current) => current.map((item) => item.id === streamId ? { ...item, content: `${item.content}${eventRecord.text}` } : item)); }
        },
        signal: abortController.current.signal,
      });
      if (result.conversationId) setConversationId(result.conversationId);
      persistedAssistantId = result.assistantMessageId ?? persistedAssistantId;
      if (result.reply.trim()) setMessages((current) => current.map((item) => item.id === streamId ? { ...item, id: persistedAssistantId ?? item.id, content: result.reply.trim() } : item));
      else { setMessages((current) => current.filter((item) => item.id !== streamId)); setConversationError("Kurukoo did not return a message. Nothing was marked complete."); }
      setTyping(false);
      setReadReceipt(Boolean(result.reply.trim()));
    } catch (error) {
      setTyping(false);
      setMessages((current) => current.filter((item) => item.id !== streamId));
      if (error instanceof DOMException && error.name === "AbortError") setConversationError("Generation stopped before completion.");
      else setConversationError(error instanceof Error ? error.message : "The message could not be sent. Please try again.");
    } finally {
      abortController.current = null;
      setSending(false);
    }
  };

  return (
    <ScreenContainer testID="native-chat-surface" accessibilityLabel={`Kurukoo native Chat · ${conversationStatus}`} className="px-4 pt-3" edges={["top", "left", "right"]}>
      <View testID={`native-chat-state-${conversationStatus}`} style={styles.screenBody}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScroll={(event) => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; followLatest.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 96; }} scrollEventThrottle={100} onContentSizeChange={() => { if (followLatest.current) scrollRef.current?.scrollToEnd({ animated: true }); }}>
          <View style={styles.topBar}>
            <View style={styles.brandRow}><BrandMark compact /><Text style={[styles.brandName, { color: colors.primary }]}>Agent</Text></View>
            {messages.length ? <Pressable accessibilityRole="button" accessibilityLabel="Start a new conversation" onPress={clearConversation} style={({ pressed }) => [styles.headerAction, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.contextButtonText, { color: colors.muted }]}>New</Text></Pressable> : null}
          </View>
          <SurfaceHeader eyebrow="Kurukoo" title="Coordinate what matters" right={<View style={[styles.agentBadge, { backgroundColor: `${colors.primary}16` }]}><BrandMark compact /></View>} />

          {conversationStatus === "loading" ? <SectionCard style={styles.loadingCard}><ActivityIndicator color={colors.primary} /><Text style={[styles.loadingTitle, { color: colors.foreground }]}>Preparing your conversation…</Text><Text style={[styles.cardDetail, { color: colors.muted }]}>Restoring the latest context without creating a new request.</Text></SectionCard> : conversationStatus === "error" ? <SectionCard style={styles.loadingCard}><StatusPill label="Unavailable" tone="error" /><Text style={[styles.loadingTitle, { color: colors.foreground }]}>Conversation could not be restored.</Text><Text style={[styles.cardDetail, { color: colors.muted }]}>{conversationError || "Try again from the composer."}</Text></SectionCard> : <>
            {!messages.length ? <View style={styles.welcomeBlock}><Text style={[styles.welcomeTitle, { color: colors.foreground }]}>{conversationStatus === "empty" ? "Let’s get something moving" : "Welcome back"}</Text><Text style={[styles.welcomeDetail, { color: colors.muted }]}>Ask anything, coordinate a request, or continue a conversation when you are ready.</Text></View> : null}
            <View style={styles.conversation}>
              {messages.length ? messages.filter((item) => item.content || item.id !== messages[messages.length - 1]?.id || typing).map((item, index) => <ChatRichMessage key={String(item.id)} role={item.role} content={item.content || (typing ? "Kurukoo is preparing a response…" : "")} copied={copiedMessageId === item.id} onCopy={() => void copyMessage(item)} onEdit={item.role === "user" && !sending ? () => { setDraft(item.content); setEditingId(item.id); } : undefined} feedback={feedbackById[String(item.id)]} feedbackSaving={Boolean(feedbackSavingById[String(item.id)])} onFeedback={item.role === "assistant" ? (value) => { void recordFeedback(item.id, value); } : undefined} onRegenerate={item.role === "assistant" && index === messages.length - 1 && Boolean(item.content) && !sending ? () => void ask(lastPrompt.current, true) : undefined} />) : null}
              {typing && !firstToken ? <View style={styles.typingRow}><BrandMark compact /><Text style={[styles.typingText, { color: colors.muted }]}>Kurukoo is typing…</Text><ActivityIndicator size="small" color={colors.primary} /></View> : readReceipt ? <View style={styles.receiptRow}><Text style={[styles.receiptText, { color: colors.muted }]}>Read by Kurukoo · Just now</Text></View> : null}
              {feedbackStatus ? <Text accessibilityLiveRegion="polite" style={[styles.feedbackStatus, { color: colors.muted }]}>{feedbackStatus}</Text> : null}
              {conversationError ? <View style={styles.errorRow}><StatusPill label="Not sent" tone="error" /><Text style={[styles.cardDetail, { color: colors.muted }]}>{conversationError}</Text></View> : null}
            </View>
            {activeTask ? <SectionCard style={styles.requestCard}><View style={styles.cardHeader}><View style={styles.cardTitleBlock}><Text style={[styles.cardKicker, { color: colors.primary }]}>Exact task context</Text><Text style={[styles.cardTitle, { color: colors.foreground }]}>{activeTask.title}</Text></View><StatusPill label="Preserved" tone="success" /></View><Text style={[styles.cardDetail, { color: colors.muted }]}>This Chat will continue with the selected task context when the canonical service accepts it.</Text><View style={styles.requestActions}><ActionButton label="Clear context" variant="ghost" onPress={clearActiveContext} /><ActionButton label="Open Tasks" variant="secondary" onPress={() => router.push("/(tabs)/tasks")} /></View></SectionCard> : null}
            {showVoiceCapture ? <VoiceNoteCapture onTranscript={(text) => { setDraft((current) => current ? `${current}\n${text}` : text); setShowVoiceCapture(false); }} /> : null}
          </>}
        </ScrollView>
        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput accessibilityLabel="Ask Kurukoo" placeholder={`Ask anything: ${composerExamples[placeholderIndex].slice(0, placeholderCharacters)}`} placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} onSubmitEditing={() => void ask()} returnKeyType="send" editable={!sending} multiline maxLength={2000} style={[styles.input, { color: colors.foreground }]} />
          <View style={styles.composerFooter}>
            <View style={styles.composerTools}>
              <Pressable accessibilityRole="button" accessibilityLabel={showVoiceCapture ? "Hide voice note recorder" : "Record a voice note"} accessibilityHint="Opens the microphone recorder so you can review audio before it enters Chat" accessibilityState={{ expanded: showVoiceCapture }} onPress={() => setShowVoiceCapture((value) => !value)} style={({ pressed }) => [styles.iconToolButton, { borderColor: showVoiceCapture ? colors.primary : colors.border, backgroundColor: showVoiceCapture ? `${colors.primary}12` : "transparent" }, pressed && styles.pressed]}><IconSymbol name={showVoiceCapture ? "mic.slash.fill" : "mic.fill"} size={18} color={showVoiceCapture ? colors.primary : colors.muted} /></Pressable>
              <Text accessibilityLiveRegion="polite" style={[styles.toolLabel, { color: colors.muted }]}>{sending ? "Sending…" : editingId !== undefined ? "Editing prompt" : "Private draft"}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={sending ? "Stop generating" : "Ask Kurukoo"} accessibilityHint={sending ? "Stops the current response" : "Sends your prompt to Kurukoo"} disabled={!sending && !draft.trim()} onPress={() => sending ? stopGenerating() : void ask()} style={({ pressed }) => [styles.askButton, { backgroundColor: colors.primary }, (!sending && !draft.trim()) && styles.askDisabled, pressed && styles.pressed]}><Text style={styles.askText}>{sending ? "Stop" : "Ask Kurukoo"}</Text></Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}


const styles = StyleSheet.create({
  screenBody: { flex: 1, gap: 10 },
  content: { paddingBottom: 18, gap: 16 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16 },
  contextButton: { minWidth: 72, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  headerAction: { minWidth: 58, minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  contextButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  agentBadge: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  notificationCard: { gap: 9 },
  loadingCard: { alignItems: "center", gap: 9, paddingVertical: 24 },
  loadingTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, textAlign: "center" },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  typingText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  receiptRow: { alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 4 },
  receiptText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  feedbackStatus: { fontFamily: "Inter_500Medium", fontSize: 11, textAlign: "center", paddingHorizontal: 12, paddingVertical: 4 },
  errorRow: { gap: 7, paddingHorizontal: 10, paddingVertical: 9 },
  emptyHint: { paddingHorizontal: 10, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  notificationTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dismiss: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  notificationTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17 },
  welcomeBlock: { gap: 7 },
  welcomeTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 24, lineHeight: 30 },
  welcomeDetail: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  conversation: { gap: 5 },
  quickPrompts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginLeft: 33, marginBottom: 8 },
  prompt: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  promptText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  contextCard: { gap: 12 },
  contextHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contextTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18 },
  contextRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: KURUKOO_VISUAL_TOKENS.border },
  rowLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  rowValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  contextMemory: { flexDirection: "row", alignItems: "center", gap: 8 },
  memoryCopy: { flex: 1, gap: 2 },
  rowDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  requestCard: { gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardTitleBlock: { flex: 1, gap: 4 },
  cardKicker: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  cardTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  cardDetail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  requestActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  composer: { minHeight: 102, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, gap: 7, marginBottom: 2 },
  input: { minHeight: 44, maxHeight: 88, paddingHorizontal: 2, paddingVertical: 5, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 23 },
  composerFooter: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  composerTools: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  iconToolButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toolButton: { minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  toolButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  toolDisabled: { opacity: 0.46 },
  toolLabel: { flexShrink: 1, fontFamily: "Inter_500Medium", fontSize: 11 },
  askButton: { minHeight: 44, minWidth: 74, paddingHorizontal: 15, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  askDisabled: { opacity: 0.48 },
  askText: { color: KURUKOO_VISUAL_TOKENS.onPrimary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
