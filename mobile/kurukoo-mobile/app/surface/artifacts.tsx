import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { router } from "expo-router";

import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

 type Artifact = { id: number; title: string; storageUrl: string; storageProvider: string; storageStatus: string; externalObjectId: string | null; mimeType: string; durationMs: number | null; transcript: string | null; transcriptState: string; createdAt: string };

function ArtifactRow({ artifact, colors, onRefresh }: { artifact: Artifact; colors: ReturnType<typeof useColors>; onRefresh: () => void }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const player = useAudioPlayer({ uri: `${getApiBaseUrl()}/api/os/artifacts/${artifact.id}/content` });
  const deleteReference = trpc.os.artifacts.deleteReference.useMutation();
  const deleteOriginal = trpc.os.artifacts.deleteOriginal.useMutation();
  const migrate = trpc.os.artifacts.migrateToGoogleDrive.useMutation();
  const duration = artifact.durationMs ? `${Math.round(artifact.durationMs / 1000)}s` : "Duration unavailable";
  const isDrive = artifact.storageProvider === "google-drive";
  const provider = isDrive ? "Google Drive" : "Kurukoo fallback";

  const removeReference = () => void deleteReference.mutateAsync({ id: artifact.id }).then(onRefresh);
  const removeOriginal = () => void deleteOriginal.mutateAsync({ id: artifact.id }).then(onRefresh);
  const migrateArtifact = () => void migrate.mutateAsync({ id: artifact.id }).then(onRefresh);

  return <SectionCard>
    <View style={styles.header}><View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{artifact.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{new Date(artifact.createdAt).toLocaleString()} · {duration} · {artifact.mimeType}</Text></View><StatusPill label={artifact.storageStatus === "verified" ? "Verified" : artifact.storageStatus} tone={artifact.storageStatus === "verified" ? "success" : "warning"} /></View>
    <View style={styles.meta}><Text style={[styles.metaText, { color: colors.muted }]}>Storage: {provider}</Text><Text style={[styles.metaText, { color: colors.muted }]}>Transcript: {artifact.transcriptState === "saved" ? "Ready" : "Needs review"}</Text></View>
    {showTranscript ? <View style={[styles.transcript, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.detail, { color: colors.foreground }]}>{artifact.transcript || "No transcript was produced. The audio artifact remains available for playback."}</Text></View> : null}
    <View style={styles.actions}><ActionButton label="Play" variant="secondary" onPress={() => { try { player.play(); } catch { void Linking.openURL(`${getApiBaseUrl()}/api/os/artifacts/${artifact.id}/content`); } }} /><ActionButton label={showTranscript ? "Hide transcript" : "View transcript"} variant="ghost" onPress={() => setShowTranscript((value) => !value)} /></View>
    <View style={styles.actions}><ActionButton label="Use in Chat" variant="ghost" onPress={() => router.replace({ pathname: "/(tabs)", params: { artifactId: String(artifact.id) } })} />{isDrive && artifact.storageUrl ? <ActionButton label="Open in Drive" variant="ghost" onPress={() => void Linking.openURL(artifact.storageUrl)} /> : null}{!isDrive ? <ActionButton label={migrate.isPending ? "Migrating…" : "Move to Drive"} variant="ghost" onPress={() => Alert.alert("Move to Google Drive?", "This uploads the fallback copy to your connected Drive. The fallback copy remains until you remove it explicitly.", [{ text: "Cancel", style: "cancel" }, { text: "Move", onPress: migrateArtifact }])} /> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Delete Kurukoo reference for ${artifact.title}`} onPress={() => Alert.alert("Delete Kurukoo reference?", isDrive ? "This removes Kurukoo metadata only. Your Google Drive original will remain." : "This removes the Kurukoo metadata and does not claim deletion of any external original.", [{ text: "Cancel", style: "cancel" }, { text: "Delete reference", style: "destructive", onPress: removeReference }])} style={styles.delete}><Text style={[styles.deleteText, { color: colors.error }]}>Delete reference</Text></Pressable>{isDrive ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete Google Drive original for ${artifact.title}`} onPress={() => Alert.alert("Delete Google Drive original?", "This permanently deletes the original file from your connected Google Drive as well as the Kurukoo reference.", [{ text: "Cancel", style: "cancel" }, { text: "Delete original", style: "destructive", onPress: removeOriginal }])} style={styles.delete}><Text style={[styles.deleteText, { color: colors.error }]}>Delete original</Text></Pressable> : null}</View>
  </SectionCard>;
}

export default function ArtifactHistoryScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<"all" | "voice">("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = trpc.os.artifacts.list.useQuery({ search: search.trim() || undefined, from: /^\\d{4}-\\d{2}-\\d{2}$/.test(from) ? from : undefined, to: /^\\d{4}-\\d{2}-\\d{2}$/.test(to) ? to : undefined }, { retry: false });
  const filtered = useMemo(() => (query.data ?? []).filter((artifact) => filter === "all" || artifact.kind === "voice-note"), [query.data, filter]);
  return <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content}><SurfaceHeader eyebrow="Your artifacts" title="Artifact history" right={<StatusPill label={query.isLoading ? "Loading" : `${filtered.length} items`} tone="neutral" />} /><Text style={[styles.intro, { color: colors.muted }]}>Your Kurukoo references, transcripts, storage provider, and availability stay visible. Google Drive originals remain owned by you.</Text><View style={styles.searchBox}><TextInput value={search} onChangeText={setSearch} placeholder="Search transcripts and titles" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityLabel="Search artifacts" /></View><View style={styles.dateRow}><TextInput value={from} onChangeText={setFrom} placeholder="From YYYY-MM-DD" placeholderTextColor={colors.muted} style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} keyboardType="numbers-and-punctuation" accessibilityLabel="Artifact start date" /><TextInput value={to} onChangeText={setTo} placeholder="To YYYY-MM-DD" placeholderTextColor={colors.muted} style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} keyboardType="numbers-and-punctuation" accessibilityLabel="Artifact end date" /></View><View style={styles.filters}><ActionButton label="All" variant={filter === "all" ? "secondary" : "ghost"} onPress={() => setFilter("all")} /><ActionButton label="Voice notes" variant={filter === "voice" ? "secondary" : "ghost"} onPress={() => setFilter("voice")} /></View>{query.isError ? <SectionCard><Text style={[styles.detail, { color: colors.muted }]}>Artifact history is unavailable until you are authenticated.</Text></SectionCard> : null}{filtered.length === 0 && !query.isLoading ? <SectionCard><Text style={[styles.title, { color: colors.foreground }]}>No artifacts match</Text><Text style={[styles.detail, { color: colors.muted }]}>Try another search or date range. Approved voice notes and other user-owned artifacts appear here after storage evidence is confirmed.</Text></SectionCard> : null}{filtered.map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} colors={colors} onRefresh={() => void query.refetch()} />)}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 32, gap: 14 }, intro: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 }, searchBox: { width: "100%" }, input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: "Inter_400Regular", fontSize: 14 }, dateRow: { flexDirection: "row", gap: 8 }, dateInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: "Inter_400Regular", fontSize: 12 }, filters: { flexDirection: "row", gap: 8 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, copy: { flex: 1, gap: 4 }, title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 22 }, detail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 }, meta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }, metaText: { fontFamily: "Inter_500Medium", fontSize: 12 }, transcript: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }, delete: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }, deleteText: { fontFamily: "Inter_600SemiBold", fontSize: 12 } });

