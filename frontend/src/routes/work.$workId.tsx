import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { WorkItemCard, Action } from "@/components/kurukoo/primitives";
import { RequestExecution } from "@/components/kurukoo/request-execution";
import { DeliveryCandidatePicker } from "@/components/kurukoo/delivery-candidate-picker";
import { QuickRideAdapter } from "@/components/kurukoo/quick-ride-adapter";
import { ExecutionModeBridge } from "@/components/kurukoo/execution-mode-bridge";
import { ContinuityContext } from "@/components/kurukoo/continuity-context";
import { OutcomeEvidence } from "@/components/kurukoo/outcome-evidence";
import { Rows, SectionHeader } from "@/components/kurukoo/ui";
import { artifacts, entities } from "@/lib/kurukoo-demo";
import { ArtifactRow, ContactRow } from "@/components/kurukoo/cards";
import { fetchEconomicRequest, isKurukooApiConfigured, type EconomicRequest } from "@/lib/kurukoo-api";
import { useKurukoo } from "@/lib/kurukoo-store";
import { canonicalWorkItem, previewEconomicRequest } from "@/lib/work-projection";

export const Route = createFileRoute("/work/$workId")({
  head: () => ({
    meta: [
      { title: "Work request — Kurukoo" },
      { name: "description", content: "Track a Kurukoo request from start to outcome." },
    ],
  }),
  component: WorkDetail,
});

function WorkDetail() {
  const { work, advance, send } = useKurukoo();
  const { workId } = Route.useParams();
  const configured = isKurukooApiConfigured();
  const localItem = work.find((item) => item.id === workId);
  const [request, setRequest] = useState<EconomicRequest | null>(null);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (!configured) return;
    setRequestError("");
    void fetchEconomicRequest(workId)
      .then(setRequest)
      .catch((error) => setRequestError(error instanceof Error ? error.message : "Unable to load request."));
  }, [configured, workId]);

  const displayItem = useMemo(
    () => (request ? canonicalWorkItem(request) : !configured && localItem ? localItem : null),
    [configured, localItem, request],
  );
  const displayRequest = useMemo(
    () => (request ?? (!configured && localItem ? previewEconomicRequest(localItem) : null)),
    [configured, localItem, request],
  );

  if (configured && requestError && !request) {
    return (
      <>
        <PageHeader title="Request" />
        <EmptyState title="Request unavailable" body={requestError} />
        <div className="mt-4"><Link to="/work" className="text-[14px] underline">Back to Work</Link></div>
      </>
    );
  }

  if (!displayItem) {
    return (
      <>
        <PageHeader title="Request" />
        <EmptyState title="Request not found" body="This request is no longer available in your current Work list." />
        <div className="mt-4"><Link to="/work" className="text-[14px] underline">Back to Work</Link></div>
      </>
    );
  }

  const requirementEntries = request
    ? Object.entries(request.requirements ?? {}).filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    : [];
  const candidateEnabled = Boolean(request) && ["requested", "awaiting_match", "partially_matched", "matched", "quoting"].includes(request?.status ?? "");

  return (
    <div className="space-y-6">
      <PageHeader title={displayItem.title} subtitle={displayItem.detail} />
      <WorkItemCard item={displayItem} onAdvance={configured ? undefined : advance} />
      {request ? <ContinuityContext requestId={request.id} status={request.status} /> : null}
      <ExecutionModeBridge />
      {displayRequest ? <RequestExecution request={displayRequest} onAsk={send} /> : null}
      {request ? <QuickRideAdapter request={request} /> : null}
      {request ? (
        <DeliveryCandidatePicker
          requestId={request.id}
          enabled={candidateEnabled}
          onSelected={() => {
            void fetchEconomicRequest(workId).then(setRequest).catch(() => undefined);
          }}
        />
      ) : null}
      {request ? <OutcomeEvidence requestId={request.id} /> : null}

      {request ? (
        <>
          <section>
            <SectionHeader title="Request details" />
            <Rows>
              <li className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-elevated px-2.5 py-1 text-[10.5px] font-medium">{request.status.replace(/[_-]/g, " ")}</span>
                  <span className="text-[11px] text-muted-foreground">{request.skill.replace(/[_-]/g, " ")}</span>
                </div>
                {requirementEntries.length ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {requirementEntries.map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-elevated/60 px-3 py-2.5">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{key.replace(/[_-]/g, " ")}</dt>
                        <dd className="mt-1 text-[13px] leading-5">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-[12.5px] text-muted-foreground">No additional request details were returned.</p>
                )}
              </li>
            </Rows>
          </section>

          <section>
            <SectionHeader title="Commercial state" />
            <Rows>
              <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[13.5px] font-medium">Quote</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{request.quote ? "Quote information is available." : "No quote has been returned yet."}</p>
                </div>
                <span className="text-[13px] font-medium">{request.amount != null ? `${request.currency ?? ""} ${request.amount}`.trim() : "Not available"}</span>
              </li>
            </Rows>
          </section>
        </>
      ) : null}

      {!configured ? (
        <>
          <div className="rounded-xl border border-dashed border-border bg-elevated/35 px-3.5 py-2.5 text-[10.5px] text-muted-foreground">Disconnected development preview. No external action is represented as completed.</div>
          <section>
            <SectionHeader title="People" />
            <Rows>
              {entities.slice(0, 2).map((entity) => (
                <ContactRow key={entity.id} entity={entity} right={<Link to="/messages" className="text-[13px] text-muted-foreground hover:underline">Message</Link>} />
              ))}
            </Rows>
          </section>
          <section>
            <SectionHeader title="Files" />
            <Rows>{artifacts.map((artifact) => <ArtifactRow key={artifact.id} artifact={artifact} />)}</Rows>
          </section>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link to="/chat"><Action variant="primary">Continue conversation</Action></Link>
        <Link to="/work"><Action>Back to Work</Action></Link>
      </div>
    </div>
  );
}
