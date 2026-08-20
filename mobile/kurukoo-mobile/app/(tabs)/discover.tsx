import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";
import { getDiscoverHome, setDiscoverAction, type DiscoverHome } from "@/lib/platform-client";
import type { DiscoverItem } from "@/lib/discover-contract";

const sectionMeta: Record<string, [string, string]> = {
  for_you: ["For you", "Fresh and relevant"],
  nearby: ["Nearby", "Around you"],
  today: ["Daily Picks", "Time-sensitive"],
  topics: ["Topics", "Join the conversation"],
  opportunities: ["Opportunities", "Things you could act on"],
  explore: ["Explore Kurukoo", "Things Kurukoo can help you do"],
};

export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const [home, setHome] = useState<DiscoverHome | null>(null);
  const [view, setView] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDiscoverHome({ latitude: 6.5244, longitude: 3.3792, radiusMetres: 10000 });
      setHome(data);
    } catch {
      setHome({ generatedAt: new Date().toISOString(), sections: { explore: [] }, density: "empty", sparse: true, watchedItemIds: [], explanation: "Discover is available even when the local network is quiet. Ask Kurukoo directly or explore its capabilities." });
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const refresh = () => { if (refreshing) return; haptic.light(); setRefreshing(true); void load(); };
  const visibleSections = Object.entries(home?.sections || {}).filter(([key]) => view === "all" || key === view || (view === "nearby" && ["for_you", "nearby", "today"].includes(key)));
  const openChat = (item: DiscoverItem) => { haptic.light(); router.push({ pathname: "/chat", params: { prompt: item.chatAction?.prompt || `Help me explore ${item.title}` } }); };
  const watch = async (item: DiscoverItem) => { try { await setDiscoverAction(item.type, item.id, "watch"); } catch { /* do not claim a watch was stored */ } };

  if (loading && !home) return <ScreenContainer className="px-4 pt-3"><View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.muted }]}>Preparing Discover…</Text></View></ScreenContainer>;

  return <ScreenContainer className="px-4 pt-3" edges={["top", "left", "right"]}>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />} contentContainerStyle={styles.content}>
      <SurfaceHeader eyebrow="Discover" title="What could matter today" right={<StatusPill label={home?.density === "rich" ? "Rich local view" : home?.density === "sparse" ? "Sparse but useful" : "Explore-first"} tone={home?.density === "rich" ? "success" : "neutral"} />} />
      <Text style={[styles.subtitle, { color: colors.muted }]}>Find things to do, buy, follow, watch, ask about or hand to Kurukoo.</Text>
      <View style={styles.filters}>{[["all","All"],["nearby","Nearby"],["topics","Topics"],["opportunities","Opportunities"],["explore","What Kurukoo can do"]].map(([key,label]) => <Pressable key={key} onPress={() => { haptic.selection(); setView(key); }} style={[styles.filter, { borderColor: colors.border, backgroundColor: view === key ? `${colors.primary}16` : colors.surface }]}><Text style={[styles.filterText, { color: view === key ? colors.primary : colors.muted }]}>{label}</Text></Pressable>)}</View>
      {home?.sparse ? <SectionCard><Text style={[styles.title, { color: colors.foreground }]}>A quieter area can still be useful</Text><Text style={[styles.muted, { color: colors.muted }]}>{home.explanation}</Text><ActionButton label="Ask Kurukoo" onPress={() => openChat({ id: "sparse", type: "capability", title: "something useful nearby", detail: "", chatAction: { prompt: "Help me find something useful nearby" } })} /></SectionCard> : null}
      {visibleSections.map(([key, items]) => <SectionCard key={key}><View style={styles.sectionHeader}><View><Text style={[styles.eyebrow, { color: colors.muted }]}>{sectionMeta[key]?.[1] || "Discover"}</Text><Text style={[styles.title, { color: colors.foreground }]}>{sectionMeta[key]?.[0] || key}</Text></View><StatusPill label={String(items.length)} tone="neutral" /></View>{!items.length ? <Text style={[styles.muted, { color: colors.muted }]}>Nothing attributed here yet.</Text> : items.slice(0, 6).map((item) => <View key={`${key}:${item.id}`} style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}><View style={styles.itemBody}><View style={styles.itemTitleRow}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>{item.sponsored ? <StatusPill label={item.disclosure || "Sponsored"} tone="warning" /> : null}</View><Text style={[styles.muted, { color: colors.muted }]}>{item.detail}</Text><View style={styles.badges}>{item.verified ? <StatusPill label="Verified" tone="success" /> : null}{item.available ? <StatusPill label="Available" tone="success" /> : null}{item.lifecycle ? <StatusPill label={item.lifecycle.replaceAll("_", " ")} tone="neutral" /> : null}</View><View style={styles.actions}><ActionButton label={item.type === "promotion" ? (item.ctaText || "Learn more") : item.type === "capability" ? "Ask Kurukoo" : "Open in Chat"} onPress={() => openChat(item)} /><ActionButton label="Watch" variant="secondary" onPress={() => watch(item)} /></View></View></View>)}</SectionCard>)}
      <SectionCard><Text style={[styles.eyebrow, { color: colors.primary }]}>Nearby map</Text><Text style={[styles.title, { color: colors.foreground }]}>Map stays a presentation layer</Text><Text style={[styles.muted, { color: colors.muted }]}>The canonical feed powers the mobile surface. The full privacy-preserving map remains available on the web Discover surface.</Text><ActionButton label="Open Discover on web" variant="secondary" onPress={() => router.push("/surface/discovery")} /></SectionCard>
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 32, gap: 14 }, loading: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center", gap: 10 }, subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, filter: { minHeight: 34, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center" }, filterText: { fontFamily: "Inter_500Medium", fontSize: 12 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 9 }, eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }, title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 22 }, muted: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }, item: { borderWidth: 1, borderRadius: 14, padding: 11, marginTop: 8 }, itemBody: { gap: 6 }, itemTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, itemTitle: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14 }, badges: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 } });
