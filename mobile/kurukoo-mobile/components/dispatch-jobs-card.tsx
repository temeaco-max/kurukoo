import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton, EmptyState, EvidenceRow, SectionCard, StatusPill } from "@/components/kurukoo-ui";
import { useColors } from "@/hooks/use-colors";
import {
  acceptDispatchJob,
  getMyDispatchJobs,
  markDispatchJobArrived,
  reportDispatchJobCompleted,
} from "@/lib/platform-client";
import type { DispatchLeadStatus, ProviderDispatchJob } from "@/lib/quick-ride-contract";

const STATUS_TONE: Record<DispatchLeadStatus, "neutral" | "success" | "warning" | "error"> = {
  offered: "warning",
  accepting: "warning",
  accepted: "warning",
  arrived: "warning",
  completion_reported: "warning",
  completed: "success",
  declined: "neutral",
  expired: "neutral",
  cancelled: "neutral",
};

const STATUS_EXPLANATION: Record<DispatchLeadStatus, string> = {
  offered: "You have been offered this job. Accepting may use your Kurukoo Points for the lead.",
  accepting: "Acceptance is being recorded.",
  accepted: "You accepted this job. Head to the pickup, then report arrival.",
  arrived: "Arrival recorded. Finish the job, then report completion with a reference.",
  completion_reported: "Your completion report is with the customer. Kurukoo has not marked the job done yet.",
  completed: "The customer confirmed this job. Feedback may be available.",
  declined: "This offer is no longer available.",
  expired: "This offer expired.",
  cancelled: "This request was cancelled.",
};

const toIsoMinute = (date: Date) => new Date(date.getTime() - date.getMilliseconds()).toISOString();

function nextActionFor(status: DispatchLeadStatus): "accept" | "arrive" | "complete" | null {
  if (status === "offered") return "accept";
  if (status === "accepted") return "arrive";
  if (status === "arrived") return "complete";
  return null;
}

export function DispatchJobsCard() {
  const colors = useColors();
  const [jobs, setJobs] = useState<ProviderDispatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [referenceFor, setReferenceFor] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState("");
  const [completedAtText, setCompletedAtText] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getMyDispatchJobs();
      setJobs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch jobs could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(async (job: ProviderDispatchJob, action: "accept" | "arrive") => {
    setBusyLeadId(job.lead.id);
    setNotice(null);
    try {
      if (action === "accept") await acceptDispatchJob(job.lead.id);
      else await markDispatchJobArrived(job.lead.id);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "That action could not be completed.";
      setNotice(message);
      if (/no longer available|accepted this dispatch first/i.test(message)) await load();
    } finally {
      setBusyLeadId(null);
    }
  }, [load]);

  const reportCompletion = useCallback(async (leadId: string) => {
    const completedAt = completedAtText.trim() ? new Date(completedAtText.trim()) : new Date();
    if (Number.isNaN(completedAt.getTime())) {
      setNotice("Use a valid completion time, for example 2026-09-17 14:30.");
      return;
    }
    setBusyLeadId(leadId);
    setNotice(null);
    try {
      await reportDispatchJobCompleted(leadId, { reference: referenceText.trim(), completedAt: toIsoMinute(completedAt) });
      setReferenceFor(null);
      setReferenceText("");
      setCompletedAtText("");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The completion report could not be submitted.");
    } finally {
      setBusyLeadId(null);
    }
  }, [completedAtText, load, referenceText]);

  if (loading) {
    return (
      <SectionCard style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your dispatch jobs</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>Checking for offered work…</Text>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your dispatch jobs</Text>
        <Text style={[styles.muted, { color: colors.muted }]} accessibilityRole="alert">{error}</Text>
        <ActionButton label="Try again" variant="secondary" onPress={() => void load()} />
      </SectionCard>
    );
  }

  if (!jobs.length) {
    return (
      <SectionCard style={styles.card}>
        <EmptyState title="No dispatch jobs yet" detail="When a nearby request is broadcast to your skills, it appears here with everything you need to accept and complete it." />
      </SectionCard>
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your dispatch jobs</Text>
      {notice ? <Text style={[styles.notice, { color: colors.muted }]} accessibilityRole="alert">{notice}</Text> : null}
      {jobs.map((job) => {
        const action = nextActionFor(job.lead.status);
        const place = [job.request.origin, job.request.destination].filter(Boolean).join(" → ");
        return (
          <SectionCard key={job.lead.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.copy}>
                <Text style={[styles.jobTitle, { color: colors.foreground }]}>
                  {job.request.description || place || `${job.request.skill.replace(/_/g, " ")} request`}
                </Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {[place, job.request.pickupAt, job.request.passengers ? `${job.request.passengers} passenger(s)` : undefined]
                    .filter(Boolean)
                    .join(" · ") || "No route details were supplied."}
                </Text>
              </View>
              <StatusPill label={job.lead.status.replace(/_/g, " ")} tone={STATUS_TONE[job.lead.status]} />
            </View>
            <EvidenceRow label="Status" value={STATUS_EXPLANATION[job.lead.status]} state={STATUS_TONE[job.lead.status]} />
            <EvidenceRow label="Request state" value={`${job.request.status.replace(/_/g, " ")} — the customer's own record`} />
            {job.lead.communicationSessionId ? (
              <EvidenceRow label="Provider session" value="A call/chat session is open for this job." state="success" />
            ) : null}
            {action && action !== "complete" ? (
              <ActionButton
                label={action === "accept" ? "Accept job" : "Report arrival"}
                onPress={() => void act(job, action)}
                style={styles.actionSpacing}
              />
            ) : null}
            {action === "complete" && referenceFor !== job.lead.id ? (
              <ActionButton
                label="Report completed…"
                variant="secondary"
                onPress={() => {
                  setReferenceFor(job.lead.id);
                  setCompletedAtText(toIsoMinute(new Date()).replace("T", " ").slice(0, 16));
                }}
                style={styles.actionSpacing}
              />
            ) : null}
            {action === "complete" && referenceFor === job.lead.id ? (
              <View style={styles.completionEditor}>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  Kurukoo needs evidence before reporting completion. The customer still confirms the outcome.
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.muted, color: colors.foreground }]}
                  value={referenceText}
                  onChangeText={setReferenceText}
                  placeholder="Completion reference (trip, ticket or receipt)"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Completion reference"
                />
                <TextInput
                  style={[styles.input, { borderColor: colors.muted, color: colors.foreground }]}
                  value={completedAtText}
                  onChangeText={setCompletedAtText}
                  placeholder="Completed at (YYYY-MM-DD HH:MM)"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Completion time"
                />
                <View style={styles.actionsRow}>
                  <ActionButton label={busyLeadId === job.lead.id ? "Reporting…" : "Submit report"} onPress={() => void reportCompletion(job.lead.id)} />
                  <ActionButton label="Cancel" variant="ghost" onPress={() => { setReferenceFor(null); setReferenceText(""); }} />
                </View>
              </View>
            ) : null}
          </SectionCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: { gap: 10 },
  cardTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16, lineHeight: 22 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  copy: { flex: 1, gap: 4 },
  jobTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15, lineHeight: 21 },
  muted: { fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18 },
  notice: { fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 17 },
  actionSpacing: { marginTop: 2 },
  completionEditor: { gap: 8, marginTop: 4 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, fontFamily: "Inter_400Regular", fontSize: 14 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
