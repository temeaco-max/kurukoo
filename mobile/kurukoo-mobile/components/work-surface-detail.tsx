import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";

import { ActionButton, ContinuityBand, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  parsePausedWorkItems,
  parseReminderDrafts,
  REMINDER_DRAFTS_KEY,
  ReminderDraft,
  serializePausedWorkItems,
  serializeReminderDrafts,
  validateReminderDraft,
  WORK_SURFACE_STATE_KEY,
} from "@/lib/work-surface-state";
import { scheduleReminderOnDevice } from "@/lib/notifications";

export type WorkSurfaceKind = "requests" | "reminders";

type WorkItem = { title: string; detail: string; status: string; tone: "neutral" | "success" | "warning"; evidence: string; time?: string; date?: string };

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const readableDate = (value: string) => { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };

const content: Record<WorkSurfaceKind, { eyebrow: string; title: string; intro: string; items: WorkItem[] }> = {
  requests: {
    eyebrow: "Requests",
    title: "Your requests",
    intro: "Review active, waiting and completed work without losing the canonical Chat context.",
    items: [
      { title: "Find a reliable phone repairer", detail: "Matching evidence-backed options near your chosen area.", status: "Working", tone: "warning", evidence: "Candidate matching is in progress. No provider outcome is claimed." },
      { title: "Compare a grocery basket", detail: "Waiting for you to confirm the preferred offer.", status: "Waiting for you", tone: "warning", evidence: "The offer is sourced; price and provider acceptance remain pending confirmation." },
      { title: "Evening safety check-in", detail: "Your check-in is scheduled and privacy-protected.", status: "Complete", tone: "success", evidence: "The internal reminder state is complete. External delivery is not implied." },
    ],
  },
  reminders: {
    eyebrow: "Reminders",
    title: "Keep the thread alive",
    intro: "Reminders return useful context to Chat at the right time. They remain editable, pausable and explicit about delivery state.",
    items: [
      { title: "Team sync", detail: "Bring this back into the conversation in 15 minutes.", status: "Scheduled", tone: "success", evidence: "Saved locally and ready to continue in Chat.", time: "09:15", date: isoDate(new Date(Date.now() + 86400000)) },
      { title: "Review project updates", detail: "Tomorrow at 9:00 AM.", status: "Saved", tone: "success", evidence: "The reminder is internal and will not claim external notification delivery unless configured.", time: "09:00", date: isoDate(new Date(Date.now() + 86400000)) },
      { title: "Follow up with repairer", detail: "Paused while you decide what to do next.", status: "Paused", tone: "neutral", evidence: "The draft context is preserved and can be resumed from Chat.", time: "17:30", date: isoDate(new Date(Date.now() + 2 * 86400000)) },
    ],
  },
};

export function WorkSurfaceDetail({ kind }: { kind: WorkSurfaceKind }) {
  const colors = useColors();
  const item = content[kind];
  const [paused, setPaused] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReminderDraft>>({});
  const [hydrated, setHydrated] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(WORK_SURFACE_STATE_KEY), AsyncStorage.getItem(REMINDER_DRAFTS_KEY)]).then(([pausedRaw, draftsRaw]) => {
      setPaused(parsePausedWorkItems(pausedRaw));
      setDrafts(parseReminderDrafts(draftsRaw));
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(WORK_SURFACE_STATE_KEY, serializePausedWorkItems(paused));
  }, [hydrated, paused]);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(REMINDER_DRAFTS_KEY, serializeReminderDrafts(drafts));
  }, [drafts, hydrated]);

  const getDraft = (entry: WorkItem): ReminderDraft => drafts[entry.title] ?? { title: entry.title, detail: entry.detail, time: entry.time ?? "09:00", date: entry.date ?? isoDate(new Date(Date.now() + 86400000)) };
  const selectedDraft = selected && kind === "reminders" ? getDraft(item.items.find((entry) => entry.title === selected) ?? item.items[0]) : null;
  const selectedValidation = useMemo(() => selectedDraft ? validateReminderDraft(selectedDraft) : null, [selectedDraft]);

  const updateDraft = (entry: WorkItem, patch: Partial<ReminderDraft>) => {
    const current = getDraft(entry);
    setDrafts((value) => ({ ...value, [entry.title]: { ...current, ...patch } }));
  };

  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SurfaceHeader eyebrow={item.eyebrow} title={item.title} right={<StatusPill label={`${item.items.length} items`} tone="neutral" />} />
        <Text style={[styles.intro, { color: colors.muted }]}>{item.intro}</Text>
        {selected ? <ContinuityBand contextLabel={kind === "reminders" ? "Reminder" : "Request"} contextId={selected} evidence="This exact item remains the owner-scoped context when you open detail, pause, edit or return to Chat. External delivery is never inferred from local state." action={<ActionButton label="Return to Chat" variant="ghost" onPress={() => router.replace("/(tabs)")} />} /> : null}
        {item.items.map((entry) => {
          const isPaused = paused.includes(entry.title);
          const isSelected = selected === entry.title;
          const reminderDraft = kind === "reminders" ? getDraft(entry) : null;
          return (
            <SectionCard key={entry.title} style={isSelected ? { borderColor: colors.primary } : undefined}>
              <View style={styles.header}>
                <View style={styles.copy}>
                  <Text style={[styles.kicker, { color: colors.primary }]}>{isPaused ? "Paused" : entry.status}</Text>
                  <Text style={[styles.title, { color: colors.foreground }]}>{reminderDraft?.title ?? entry.title}</Text>
                  <Text style={[styles.detail, { color: colors.muted }]}>{reminderDraft?.detail ?? entry.detail}</Text>
                </View>
                <StatusPill label={isPaused ? "Paused" : entry.status} tone={isPaused ? "neutral" : entry.tone} />
              </View>
              <View style={[styles.evidence, { backgroundColor: `${entry.tone === "success" ? colors.success : colors.primary}10`, borderColor: `${entry.tone === "success" ? colors.success : colors.primary}2B` }]}>
                <Text style={[styles.evidenceLabel, { color: colors.foreground }]}>Evidence and next state</Text>
                <Text style={[styles.detail, { color: colors.muted }]}>{entry.evidence}</Text>
              </View>
              {isSelected && kind === "reminders" && reminderDraft ? (
                <View style={[styles.editor, { borderColor: colors.border }]}>
                  <Text style={[styles.editorTitle, { color: colors.foreground }]}>Edit reminder</Text>
                  <TextInput accessibilityLabel="Reminder title" value={reminderDraft.title} onChangeText={(title) => updateDraft(entry, { title })} placeholder="Reminder title" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
                  <TextInput accessibilityLabel="Reminder context" value={reminderDraft.detail} onChangeText={(detail) => updateDraft(entry, { detail })} placeholder="Useful context to return to Chat" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multilineInput, { color: colors.foreground, borderColor: colors.border }]} />
                  <View style={styles.timeRow}><Text style={[styles.timeLabel, { color: colors.muted }]}>Date</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose reminder date" onPress={() => setShowDatePicker(true)} style={[styles.dateButton, { borderColor: colors.border }]}><Text style={[styles.dateButtonText, { color: colors.foreground }]}>{readableDate(reminderDraft.date)}</Text></Pressable></View>
                  {showDatePicker && Platform.OS !== "web" ? <DateTimePicker value={new Date(`${reminderDraft.date}T${reminderDraft.time}:00`)} mode="date" minimumDate={new Date()} onChange={(_event, selectedDate) => { setShowDatePicker(false); if (selectedDate) updateDraft(entry, { date: isoDate(selectedDate) }); }} /> : null}
                  {Platform.OS === "web" ? <TextInput accessibilityLabel="Reminder date" value={reminderDraft.date} onChangeText={(date) => updateDraft(entry, { date })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border }]} /> : null}
                  <View style={styles.timeRow}><Text style={[styles.timeLabel, { color: colors.muted }]}>Time</Text><TextInput accessibilityLabel="Reminder time" value={reminderDraft.time} onChangeText={(time) => updateDraft(entry, { time })} placeholder="09:00" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" style={[styles.timeInput, { color: colors.foreground, borderColor: colors.border }]} /></View>
                  <Text style={[styles.validation, { color: selectedValidation ? colors.error : colors.success }]}>{selectedValidation ?? "Saved locally. External notification delivery is not claimed."}</Text>
                  <ActionButton label="Schedule on device" variant="secondary" onPress={() => { if (!selectedValidation) void scheduleReminderOnDevice(reminderDraft).then((id) => setScheduleStatus(id ? "Scheduled locally on this device. External delivery is not claimed." : "Local scheduling requires a physical device with notification permission.")); }} />
                </View>
              ) : null}
              <View style={styles.actions}>
                <ActionButton label={isSelected ? "Close detail" : "Open detail"} variant="secondary" onPress={() => setSelected(isSelected ? null : entry.title)} />
                <ActionButton label={isPaused ? "Resume" : "Pause"} variant="ghost" onPress={() => setPaused((current) => current.includes(entry.title) ? current.filter((value) => value !== entry.title) : [...current, entry.title])} />
              </View>
            </SectionCard>
          );
        })}
        {selected && kind === "requests" ? <SectionCard style={styles.continuation}><Text style={[styles.title, { color: colors.foreground }]}>Return to Chat</Text><Text style={[styles.detail, { color: colors.muted }]}>Continue from the Chat surface with this item’s current status visible. Any external action remains pending until the appropriate evidence is available.</Text><ActionButton label="Return to Chat" onPress={() => router.replace("/(tabs)")} /></SectionCard> : null}
        {selected && kind === "reminders" ? <SectionCard style={styles.continuation}><Text style={[styles.title, { color: colors.foreground }]}>Return to Chat</Text><Text style={[styles.detail, { color: colors.muted }]}>The edited reminder is saved locally and can return this context to Chat. External delivery remains unconfigured.</Text>{scheduleStatus ? <Text accessibilityRole="alert" style={[styles.validation, { color: colors.muted }]}>{scheduleStatus}</Text> : null}<ActionButton label="Return to Chat" onPress={() => router.replace("/(tabs)")} /></SectionCard> : null}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={[styles.backText, { color: colors.primary }]}>Back to Chat</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 16 },
  intro: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  copy: { flex: 1, gap: 4 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  evidence: { borderWidth: 1, borderRadius: 13, padding: 11, gap: 4 },
  evidenceLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  editor: { borderWidth: 1, borderRadius: 13, padding: 11, gap: 9 },
  editorTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, fontFamily: "Inter_400Regular", fontSize: 14 },
  multilineInput: { minHeight: 76, textAlignVertical: "top" },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  timeLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  timeInput: { width: 100, minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontFamily: "Inter_500Medium", fontSize: 14 },
  dateButton: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, justifyContent: "center" },
  dateButtonText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  dateInput: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontFamily: "Inter_500Medium", fontSize: 14 },
  validation: { fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  continuation: { gap: 8 },
  back: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
