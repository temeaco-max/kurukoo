import { MessageCircle, Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel, SoftSurface, Rows } from "@/components/kurukoo/ui";
import { fetchSurveyPrompt, submitSurveyResponse, type SurveyPrompt, type SurveyResponse } from "@/lib/kurukoo-api";
import { isKurukooApiConfigured } from "@/lib/kurukoo-api";
import { cn } from "@/lib/utils";

export function SurveyPromptCard() {
  const [prompt, setPrompt] = useState<SurveyPrompt | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SurveyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isKurukooApiConfigured()) return;
    let cancelled = false;
    setLoading(true);
    fetchSurveyPrompt()
      .then((p) => { if (!cancelled) { setPrompt(p); setError(p ? null : "No survey available"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit() {
    if (!prompt || !answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitSurveyResponse(prompt.question, answer.trim());
      setSubmitted(result ?? null);
      setAnswer("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit survey response");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isKurukooApiConfigured()) return null;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <span className="text-[12.5px] font-medium">Quick survey</span>
        </div>
        <button
          type="button"
          onClick={() => { setSubmitted(null); setPrompt(null); setLoading(true); }}
          className="text-[10.5px] text-muted-foreground hover:text-foreground"
          aria-label="Get a new survey question"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-[11.5px] text-muted-foreground">Loading survey…</span>
        </div>
      ) : error && !prompt ? (
        <div className="px-4 py-4">
          <p className="text-[11.5px] text-destructive">{error}</p>
        </div>
      ) : submitted ? (
        <div className="px-4 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
            <Check className="mt-0.5 size-5 text-[var(--color-success)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">Thanks for your input</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Your answer has been recorded for <span className="font-medium text-foreground">{submitted.topic}</span>.
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => { void fetchSurveyPrompt().then((p) => { setPrompt(p); setSubmitted(null); }); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11.5px] text-muted-foreground hover:bg-elevated"
            >
              Answer another
            </button>
          </div>
        </div>
      ) : prompt ? (
        <div className="px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Topic: {prompt.topic}</p>
          <p className="mt-2 text-[13.5px] font-medium">{prompt.question}</p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            {prompt.answerTypes.join(", ")}
          </p>
          <div className="mt-3">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Share your answer…"
              className="min-h-[72px] rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] outline-none placeholder:text-muted-foreground resize-y"
            />
          </div>
          {error && <p className="mt-2 text-[10.5px] text-destructive">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11.5px] text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Submit
            </button>
            <button
              type="button"
              onClick={() => setAnswer("")}
              className="text-[11.5px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}