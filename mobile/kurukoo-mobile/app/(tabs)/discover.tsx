import { useEffect, useMemo, useState } from "react";
import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ActionButton, BrandMark, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { discoveries } from "@/lib/kurukoo-data";
import { useColors } from "@/hooks/use-colors";
import { haptic } from "@/lib/haptics";

const filters = ["All", "Sources", "Opportunities", "Help requests"];
const resultRows = [
  { id: "community-transport", title: "Community transport update", source: "City Transport Office", distance: "~350 m", category: "Transit", tone: "success" as const },
  { id: "meal-support", title: "Volunteer needed: Meal support", source: "Local Aid Network", distance: "~600 m", category: "Meals", tone: "warning" as const },
  { id: "road-maintenance", title: "Road maintenance notice", source: "Public Works Dept.", distance: "~750 m", category: "Notice", tone: "success" as const },
  { id: "graphic-designer", title: "Looking for graphic designer", source: "Small Biz Collective", distance: "~1.1 km", category: "Design", tone: "neutral" as const },
  { id: "community-workshop", title: "Free community workshop", source: "Community Learning Hub", distance: "~1.3 km", category: "Workshop", tone: "success" as const },
];

export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const [radarOn, setRadarOn] = useState(true);
  const [listMode, setListMode] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [lowBandwidth, setLowBandwidth] = useState(true);
  const [radarState, setRadarState] = useState<"loading" | "ready" | "empty">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const visibleRows = useMemo(() => activeFilter === "Help requests" ? [] : resultRows, [activeFilter]);
  useEffect(() => {
    setRadarState("loading");
    const timer = setTimeout(() => setRadarState(visibleRows.length ? "ready" : "empty"), 320);
    return () => clearTimeout(timer);
  }, [visibleRows]);

  const toggleRadar = () => { haptic.medium(); setRadarOn((value) => !value); };
  const refreshRadar = () => {
    if (refreshing) return;
    haptic.light();
    setRefreshing(true);
    setRadarState("loading");
    setTimeout(() => {
      setRefreshing(false);
      setRadarState(visibleRows.length ? "ready" : "empty");
    }, 650);
  };

  return (
    <ScreenContainer className="px-4 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshRadar} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />} >
        <SurfaceHeader eyebrow="Discover" title="Nearby Radar" right={<StatusPill label={radarOn ? "Radar active" : "Radar paused"} tone={radarOn ? "success" : "neutral"} />} />
        <Text style={[styles.subtitle, { color: colors.muted }]}>Discover nearby entities with source transparency and explicit location consent.</Text>
        <SectionCard style={styles.radarBanner}><View style={styles.radarIcon}><BrandMark compact /></View><View style={styles.bannerCopy}><Text style={[styles.bannerTitle, { color: colors.foreground }]}>Radar {radarOn ? "active" : "paused"}</Text><Text style={[styles.bannerDetail, { color: colors.muted }]}>{refreshing ? "Updating source-attributed results…" : "Showing results near your approximate area"}</Text></View><ActionButton label={radarOn ? "Pause" : "Resume"} variant="secondary" onPress={toggleRadar} /></SectionCard>
        <View style={styles.modeRow}><View style={styles.modeTabs}><Pressable accessibilityRole="button" onPress={() => { haptic.selection(); setListMode(false); }} style={[styles.modeTab, !listMode && { borderBottomColor: colors.primary }]}><Text style={[styles.modeText, { color: !listMode ? colors.primary : colors.muted }]}>Map</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { haptic.selection(); setListMode(true); }} style={[styles.modeTab, listMode && { borderBottomColor: colors.primary }]}><Text style={[styles.modeText, { color: listMode ? colors.primary : colors.muted }]}>List</Text></Pressable></View><Text style={[styles.resultCount, { color: colors.muted }]}>12 results</Text></View>
        {!listMode ? <View style={[styles.mapCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.mapRoad, styles.roadOne]} /><View style={[styles.mapRoad, styles.roadTwo]} /><View style={[styles.mapRiver, { backgroundColor: `${colors.primary}20` }]} /><View style={[styles.areaCircle, { borderColor: `${colors.primary}77`, backgroundColor: `${colors.primary}12` }]} /><View style={[styles.mapPin, { backgroundColor: colors.primary }]} /><View style={[styles.mapPin, styles.pinTwo, { backgroundColor: colors.success }]} /><View style={[styles.mapPin, styles.pinThree, { backgroundColor: colors.warning }]} /><View style={styles.mapLegend}><Text style={[styles.legendText, { color: colors.muted }]}>Approximate area · source-attributed</Text><Text style={[styles.scaleText, { color: colors.foreground }]}>500 m</Text></View></View> : null}
        <View style={styles.filterRow}>{filters.map((filter) => <Pressable key={filter} accessibilityRole="button" onPress={() => { haptic.selection(); setActiveFilter(filter); }} style={[styles.filterChip, { borderColor: colors.border, backgroundColor: activeFilter === filter ? `${colors.primary}16` : colors.surface }]}><Text style={[styles.filterText, { color: activeFilter === filter ? colors.primary : colors.muted }]}>{filter}</Text></Pressable>)}</View>
        <View style={[styles.privacyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.privacyDot, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}55` }]}><BrandMark compact /></View><View style={styles.privacyCopy}><Text style={[styles.privacyTitle, { color: colors.foreground }]}>Approximate location</Text><Text style={[styles.privacyDetail, { color: colors.muted }]}>Your approximate area is shown to protect privacy. Locations are rounded to a neighborhood level.</Text><Text style={[styles.learnMore, { color: colors.primary }]}>Learn more</Text></View></View>
        {listMode ? radarState === "loading" ? <SectionCard style={styles.loadingCard}><ActivityIndicator color={colors.primary} /><Text style={[styles.listTitle, { color: colors.foreground }]}>Refreshing Nearby Radar…</Text><Text style={[styles.privacyDetail, { color: colors.muted }]}>Checking source-attributed results near your approximate area.</Text></SectionCard> : radarState === "empty" ? <SectionCard style={styles.loadingCard}><BrandMark compact /><Text style={[styles.listTitle, { color: colors.foreground }]}>No source-attributed results here yet.</Text><Text style={[styles.privacyDetail, { color: colors.muted }]}>Try another filter or check again later. Kurukoo has not substituted an unverified provider or invented a nearby result.</Text><ActionButton label="Show all results" variant="secondary" onPress={() => setActiveFilter("All")} /></SectionCard> : <View style={styles.listSection}><View style={styles.listHeader}><Text style={[styles.listTitle, { color: colors.foreground }]}>Within approx. 2 km</Text><Text style={[styles.resultCount, { color: colors.muted }]}>{visibleRows.length} results · Source-attributed</Text></View>{visibleRows.map((item) => <Pressable key={item.title} accessibilityRole="button" onPress={() => { haptic.light(); router.push({ pathname: "/surface/discovery/[id]", params: { id: item.id } }); }} style={({ pressed }) => [styles.resultRow, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.resultIcon, { backgroundColor: `${item.tone === "success" ? colors.success : item.tone === "warning" ? colors.warning : colors.primary}18` }]}><Text style={[styles.resultIconText, { color: item.tone === "success" ? colors.success : item.tone === "warning" ? colors.warning : colors.primary }]}>{item.category}</Text></View><View style={styles.resultCopy}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.resultSource, { color: colors.muted }]}>Shared by {item.source}</Text><View style={styles.sourceState}><StatusPill label="Source attributed" tone="success" /></View></View><Text style={[styles.distance, { color: colors.muted }]}>{item.distance}</Text></Pressable>)}</View> : <SectionCard><Text style={[styles.listTitle, { color: colors.foreground }]}>Select a result</Text><Text style={[styles.privacyDetail, { color: colors.muted }]}>Map results are approximate and source-attributed. Choose List for the low-bandwidth view.</Text></SectionCard>}
        <SectionCard style={styles.lowBandwidth}><View style={styles.lowCopy}><Text style={[styles.listTitle, { color: colors.foreground }]}>Low bandwidth mode</Text><Text style={[styles.privacyDetail, { color: colors.muted }]}>Using minimal data</Text></View><ActionButton label={lowBandwidth ? "Change" : "Enable"} variant="secondary" onPress={() => setLowBandwidth((value) => !value)} /></SectionCard>
        <SectionCard style={styles.goLiveCard}><Text style={[styles.kicker, { color: colors.primary }]}>Ways to explore</Text><Text style={[styles.listTitle, { color: colors.foreground }]}>Share something nearby</Text><Text style={[styles.privacyDetail, { color: colors.muted }]}>Go Live only after explicit approximate-location consent. Your exact location is never collected for this broadcast.</Text><ActionButton label="Review Go Live" onPress={() => router.push("/surface/go-live")} /></SectionCard>
        {discoveries.slice(0, 2).map((item) => <SectionCard key={item.id}><View style={styles.itemHeader}><Text style={[styles.listTitle, { color: colors.foreground }]}>{item.title}</Text><StatusPill label={item.tag} tone={item.tag === "Opportunity" ? "warning" : "neutral"} /></View><Text style={[styles.privacyDetail, { color: colors.muted }]}>{item.detail}</Text><ActionButton label="Open detail" variant="ghost" onPress={() => router.push({ pathname: "/surface/discovery/[id]", params: { id: item.id } })} /></SectionCard>)}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  radarBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  radarIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: KURUKOO_VISUAL_TOKENS.successSoft },
  radarIconText: { fontSize: 21 },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  bannerDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modeTabs: { flexDirection: "row", gap: 18 },
  modeTab: { minHeight: 40, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  modeText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  resultCount: { fontFamily: "Inter_500Medium", fontSize: 12 },
  mapCard: { minHeight: 230, borderWidth: 1, borderRadius: 18, overflow: "hidden", position: "relative", backgroundColor: KURUKOO_VISUAL_TOKENS.mapSurface },
  mapRoad: { position: "absolute", height: 16, width: "125%", backgroundColor: KURUKOO_VISUAL_TOKENS.onPrimary, transform: [{ rotate: "-24deg" }] },
  roadOne: { top: 64, left: -28 },
  roadTwo: { top: 160, left: -20, transform: [{ rotate: "18deg" }] },
  mapRiver: { position: "absolute", width: 35, height: "130%", left: 78, top: -20, transform: [{ rotate: "22deg" }] },
  areaCircle: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderStyle: "dashed", left: "35%", top: 52, alignItems: "center", justifyContent: "center" },
  mapPin: { position: "absolute", width: 15, height: 15, borderRadius: 8, left: "48%", top: 106 },
  pinTwo: { left: "24%", top: 76 },
  pinThree: { left: "68%", top: 54 },
  mapLegend: { position: "absolute", left: 14, right: 14, bottom: 12, flexDirection: "row", justifyContent: "space-between" },
  legendText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  scaleText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filterChip: { minHeight: 34, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  filterText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  privacyCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", gap: 10 },
  privacyDot: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  privacyDotText: { fontSize: 28, lineHeight: 28 },
  privacyCopy: { flex: 1, gap: 4 },
  privacyTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  privacyDetail: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  learnMore: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 2 },
  listSection: { gap: 8 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  listTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16, lineHeight: 21 },
  resultRow: { minHeight: 82, borderWidth: 1, borderRadius: 16, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  resultIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  resultIconText: { fontFamily: "Inter_600SemiBold", fontSize: 10, textAlign: "center" },
  resultCopy: { flex: 1, gap: 2 },
  resultTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  resultSource: { fontFamily: "Inter_400Regular", fontSize: 12 },
  sourceState: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  sourceText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  distance: { fontFamily: "Inter_500Medium", fontSize: 11 },
  loadingCard: { alignItems: "center", gap: 9, paddingVertical: 24 },
  lowBandwidth: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lowCopy: { flex: 1, gap: 3 },
  goLiveCard: { gap: 8 },
  kicker: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase" },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
