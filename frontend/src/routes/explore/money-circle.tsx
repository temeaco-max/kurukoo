import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Banknote, Check, CircleDollarSign, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Action } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";

export const Route = createFileRoute("/explore/money-circle")({
  head: () => ({
    meta: [{ title: "Money Circle — Kurukoo" }],
  }),
  component: MoneyCirclePage,
});

type Step = "start" | "details" | "review" | "created";

function MoneyCirclePage() {
  const [step, setStep] = useState<Step>("start");
  const [name, setName] = useState("My savings circle");
  const [amount, setAmount] = useState("20000");
  const [frequency, setFrequency] = useState("Monthly");
  const [members, setMembers] = useState("5");

  const total = useMemo(() => {
    const value = Number(amount.replace(/[^0-9]/g, "")) || 0;
    const count = Number(members) || 0;
    return value * count;
  }, [amount, members]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Money Circle"
        subtitle="Start or manage a savings circle without losing track of who contributes what."
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link to="/explore" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Explore
        </Link>
        <span>/</span>
        <span>Money & work</span>
        <span>/</span>
        <span className="text-foreground">Money Circle</span>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <Panel className="p-5 md:p-6">
          {step === "start" ? (
            <>
              <div className="grid size-11 place-items-center rounded-2xl bg-brand-tint text-brand-ink">
                <CircleDollarSign className="size-5" />
              </div>
              <h2 className="mt-4 text-[22px] font-semibold tracking-tight">
                What do you want to do?
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="rounded-2xl border border-border p-4 text-left hover:bg-elevated"
                >
                  <p className="text-[14px] font-semibold">Start a circle</p>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    Set the contribution, members and schedule.
                  </p>
                </button>
                <Link
                  to="/chat"
                  search={{ query: "Help me manage my Money Circle" } as never}
                  className="rounded-2xl border border-border p-4 text-left hover:bg-elevated"
                >
                  <p className="text-[14px] font-semibold">Manage a circle</p>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    Ask Kurukoo about an existing circle.
                  </p>
                </Link>
              </div>
            </>
          ) : step === "details" ? (
            <>
              <h2 className="text-[22px] font-semibold tracking-tight">Set up your circle</h2>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-medium">Circle name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-medium">Contribution per member</span>
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
                  />
                </label>
                <div className="grid gap-1.5">
                  <span className="text-[11px] font-medium">Frequency</span>
                  <div className="flex gap-2">
                    {["Weekly", "Monthly"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFrequency(option)}
                        className={
                          frequency === option
                            ? "rounded-xl bg-primary px-3 py-2 text-[11px] text-primary-foreground"
                            : "rounded-xl border border-border px-3 py-2 text-[11px]"
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-medium">Number of members</span>
                  <input
                    inputMode="numeric"
                    value={members}
                    onChange={(e) => setMembers(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
                  />
                </label>
              </div>
              <div className="mt-5 flex gap-2">
                <Action onClick={() => setStep("start")}>Back</Action>
                <Action variant="primary" onClick={() => setStep("review")}>
                  Review circle <ArrowRight className="size-3.5" />
                </Action>
              </div>
            </>
          ) : step === "review" ? (
            <>
              <h2 className="text-[22px] font-semibold tracking-tight">Review your circle</h2>
              <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
                <Row label="Name" value={name} />
                <Row
                  label="Contribution"
                  value={`₦${Number(amount || 0).toLocaleString()} / ${frequency.toLowerCase().replace("monthly", "month").replace("weekly", "week")}`}
                />
                <Row label="Members" value={members} />
                <Row label="Cycle total" value={`₦${total.toLocaleString()}`} />
              </div>
              <div className="mt-4 rounded-2xl bg-elevated/60 p-4 text-[11px] leading-relaxed text-muted-foreground">
                This frontend is connected to the Money Circle product path, but live money movement
                remains gated by the canonical backend payment boundary. Creating this preview does
                not move money.
              </div>
              <div className="mt-5 flex gap-2">
                <Action onClick={() => setStep("details")}>Edit</Action>
                <Action variant="primary" onClick={() => setStep("created")}>
                  Create circle <ArrowRight className="size-3.5" />
                </Action>
              </div>
            </>
          ) : (
            <>
              <div className="grid size-12 place-items-center rounded-full bg-brand-tint text-brand-ink">
                <Check className="size-5" />
              </div>
              <h2 className="mt-4 text-[22px] font-semibold tracking-tight">
                Circle ready to continue
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Your setup is captured in this development experience. The next production step is
                the authenticated Money Circle API and payment boundary.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to="/chat"
                  search={
                    { query: `Help me continue setting up my Money Circle called ${name}` } as never
                  }
                >
                  <Action variant="primary">Continue with Kurukoo</Action>
                </Link>
                <Action onClick={() => setStep("start")}>Start another</Action>
              </div>
            </>
          )}
        </Panel>

        <aside className="rounded-[22px] border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-muted-foreground" />
            <span className="text-[12px] font-semibold">Your circle at a glance</span>
          </div>
          <div className="mt-5 space-y-4">
            <Row label="Contribution" value={`₦${Number(amount || 0).toLocaleString()}`} />
            <Row label="Schedule" value={frequency} />
            <Row label="Members" value={members} />
            <Row label="Cycle" value={`₦${total.toLocaleString()}`} />
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <Users className="size-3.5" /> What comes next
            </div>
            <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
              <p>1. Confirm the circle details.</p>
              <p>2. Invite or identify members.</p>
              <p>3. Establish the contribution order.</p>
              <p>4. Authorise payments when the live boundary is enabled.</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-medium text-right">{value}</span>
    </div>
  );
}
