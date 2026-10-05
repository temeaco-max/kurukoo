import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ActionButton, SectionCard, StatusPill, SurfaceHeader } from "@/components/kurukoo-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { fetchPlaceDetail, followPlace, voteForPlaceConcept, type PlaceConcept, type PlaceDetail } from "@/lib/places-client";

export function PlaceDetailView() {
  const colors = useColors();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setError(null);
    try {
      setPlace(await fetchPlaceDetail(String(slug)));
    } catch (err) {
      setPlace(null);
      setError(err instanceof Error ? err.message : "Place not found");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function vote(concept: PlaceConcept, value: 1 | -1) {
    setVoting(concept.id);
    try {
      const next = await voteForPlaceConcept(concept.id, value, "interested");
      setPlace((prev) => (prev ? { ...prev, concepts: prev.concepts.map((c) => (c.id === next.id ? next : c)) } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setVoting(null);
    }
  }

  async function follow() {
    if (!place) return;
    try {
      await followPlace(place.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow failed");
    }
  }

  if (error && !place) {
    return (
      <ScreenContainer className="px-5 pt-3">
        <SurfaceHeader eyebrow="Places" title="Place unavailable" />
        <Text style={[styles.description, { color: colors.muted }]}>{error}</Text>
        <ActionButton label="Back" variant="ghost" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  if (!place) {
    return (
      <ScreenContainer className="px-5 pt-3">
        <ActivityIndicator />
        <Text style={[styles.description, { color: colors.muted }]}>Loading place…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-5 pt-3" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceHeader eyebrow="Places" title={place.name} right={<StatusPill label={place.status} tone="neutral" />} />
        <Text style={[styles.description, { color: colors.muted }]}>
          {[place.lga, place.state].filter(Boolean).join(", ") || "Nigeria"} · Area centre approximate
        </Text>
        <ActionButton label="Follow this place" variant="secondary" onPress={follow} />
        {error ? <Text style={[styles.description, { color: colors.muted }]}>{error}</Text> : null}

        <SectionCard>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Potential visions ({place.concepts.length})</Text>
          {place.concepts.length === 0 ? (
            <Text style={[styles.description, { color: colors.muted }]}>
              No visions yet. Open Chat and describe what this area could become.
            </Text>
          ) : (
            place.concepts.map((concept) => (
              <View key={concept.id} style={styles.concept}>
                <Text style={[styles.conceptTitle, { color: colors.foreground }]}>{concept.title}</Text>
                <Text style={[styles.description, { color: colors.muted }]}>
                  {concept.scenario.replace(/_/g, " ")} · v{concept.version} · {concept.status}
                  {concept.sponsored ? ` · Sponsored${concept.sponsorLabel ? ` by ${concept.sponsorLabel}` : ""}` : ""}
                </Text>
                <Text style={[styles.description, { color: colors.muted }]}>{concept.description}</Text>
                <View style={styles.voteRow}>
                  <ActionButton
                    label={voting === concept.id ? "Voting…" : `Support (${concept.votes.support})`}
                    variant="secondary"
                    onPress={() => void vote(concept, 1)}
                  />
                  <ActionButton
                    label={`Oppose (${concept.votes.oppose})`}
                    variant="ghost"
                    onPress={() => void vote(concept, -1)}
                  />
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <View style={[styles.truthCard, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}44` }]}>
          <Text style={[styles.truthTitle, { color: colors.foreground }]}>How to read this place</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{place.disclaimers.scenarios}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{place.disclaimers.votes}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{place.disclaimers.land}</Text>
        </View>

        <ActionButton label="Continue in Chat" onPress={() => router.replace("/(tabs)/chat")} />
        <ActionButton label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 16 },
  description: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, lineHeight: 23 },
  concept: { gap: 6, marginTop: 12 },
  conceptTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  voteRow: { flexDirection: "row", gap: 8 },
  truthCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 5 },
  truthTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16 },
});
