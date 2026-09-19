import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Message as MessageModel, WorkItem, WorkStage } from "@/lib/kurukoo-store";

export const stageLabel: Record<WorkStage, string> = {
  understanding: "Getting started",
  working: "In progress",
  needs_you: "Needs you",
  done: "Done",
};

export function Status({ stage }: { stage: WorkStage }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]",
        stage === "needs_you"
          ? "bg-accent text-accent-foreground"
          : "bg-elevated text-muted-foreground",
      )}
    >
      {stage !== "done" ? (
        <span className="size-1.5 rounded-full bg-current opacity-70 motion-safe:animate-pulse" />
      ) : (
        <Check className="size-3" strokeWidth={3} />
      )}
      {stageLabel[stage]}
    </span>
  );
}

function readableLabel(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "";
}
function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function hrefFor(data: Record<string, unknown>, fallback = "/work") {
  const id = text(data.requestId ?? data.workId ?? data.id);
  return id ? `/work/${encodeURIComponent(id)}` : fallback;
}
function CardAction({
  label,
  href,
  onClick,
  primary = false,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const className = cn(
    "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-medium transition-colors",
    primary
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-border hover:bg-elevated",
  );
  if (href)
    return (
      <Link to={href as never} className={className}>
        {label}
        <ChevronRight className="size-3.5" />
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
      <ChevronRight className="size-3.5" />
    </button>
  );
}
function Shell({
  icon,
  title,
  body,
  children,
  tone = "surface",
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
  tone?: "surface" | "tint" | "danger";
}) {
  return (
    <div
      className={cn(
        "mt-3 rounded-2xl border p-4 shadow-[var(--shadow-soft)]",
        tone === "tint"
          ? "border-primary/20 bg-brand-tint/15"
          : tone === "danger"
            ? "border-destructive/20 bg-destructive/5"
            : "border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[12px] font-semibold">{title}</p>
      </div>
      {body ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
function DataList({ data, keys }: { data: Record<string, unknown>; keys: string[] }) {
  const entries = keys
    .filter((key) => data[key] !== undefined && data[key] !== null && String(data[key]).trim())
    .slice(0, 6);
  if (!entries.length) return null;
  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
      {entries.map((key) => (
        <div key={key} className="rounded-xl bg-elevated/60 px-3 py-2">
          <dt className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {readableLabel(key)}
          </dt>
          <dd className="mt-0.5 truncate text-[11.5px]">
            {typeof data[key] === "object" ? JSON.stringify(data[key]) : String(data[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ChatCard({
  data,
  onAction,
}: {
  data: Record<string, unknown>;
  onAction?: (text: string) => void;
}) {
  const type = text(data.type).toLowerCase();
  if (type === "semantic_conversation" || data.hidden) return null;
  const options = Array.isArray(data.options)
    ? data.options.filter((v): v is string => typeof v === "string").slice(0, 8)
    : [];
  const actionText = text(data.actionText ?? data.action ?? data.canonicalAction);
  const title = text(
    data.title ?? data.label ?? data.name,
    readableLabel(type) || "Kurukoo update",
  );
  const body = text(data.body ?? data.description ?? data.message ?? data.subtitle);
  if (
    [
      "action",
      "contextual_action",
      "actions",
      "quick_replies",
      "choice",
      "choices",
      "welcome",
    ].includes(type)
  )
    return (
      <Shell icon={<Zap className="size-4 text-primary" />} title={title} body={body}>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <CardAction
              key={option}
              label={option}
              onClick={() => onAction?.(option)}
              primary={Boolean(data.primaryAction === option)}
            />
          ))}
          {actionText && !options.includes(actionText) ? (
            <CardAction label={actionText} onClick={() => onAction?.(actionText)} primary />
          ) : null}
        </div>
      </Shell>
    );
  if (["provider", "provider_match", "provider_card"].includes(type))
    return (
      <Shell
        icon={<Users className="size-4 text-primary" />}
        title={title || "Provider"}
        body={
          body ||
          "Provider context returned by Kurukoo. Availability is only confirmed when connected evidence says it is available."
        }
      >
        <DataList
          data={data}
          keys={[
            "provider",
            "providerName",
            "skill",
            "category",
            "location",
            "availability",
            "evidence",
            "freshness",
            "liveNow",
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction label="Review request" href={hrefFor(data)} primary />
          <CardAction
            label="Continue in Chat"
            onClick={() => onAction?.("Continue with this provider option")}
          />
        </div>
      </Shell>
    );
  if (["product", "product_card", "agentic_storefront"].includes(type))
    return (
      <Shell
        icon={<ShoppingBag className="size-4 text-primary" />}
        title={title || "Product"}
        body={
          body ||
          "Product context returned by Kurukoo. Review seller, price and availability before ordering."
        }
      >
        {text(data.image ?? data.imageUrl) ? (
          <img
            src={text(data.image ?? data.imageUrl)}
            alt=""
            className="mt-3 h-32 w-full rounded-xl object-cover"
          />
        ) : null}
        <DataList
          data={data}
          keys={[
            "seller",
            "sellerName",
            "price",
            "currency",
            "availability",
            "quantity",
            "delivery",
            "collection",
            "evidence",
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction
            label="Add to request"
            onClick={() => onAction?.("Add this product to my request")}
            primary
          />
          <CardAction label="Compare" onClick={() => onAction?.("Compare this option")} />
          <CardAction label="Save" onClick={() => onAction?.("Save this product")} />
        </div>
      </Shell>
    );
  if (["offer", "seller_offer", "offer_card", "quote", "quote_card"].includes(type))
    return (
      <Shell
        icon={<ShoppingBag className="size-4 text-primary" />}
        title={type.includes("quote") ? "Quote" : "Offer"}
        body={
          body ||
          "Commercial terms returned by the canonical service. Nothing is committed until you approve."
        }
        tone="tint"
      >
        <DataList
          data={data}
          keys={[
            "seller",
            "provider",
            "price",
            "amount",
            "currency",
            "discount",
            "validUntil",
            "availability",
            "delivery",
            "collection",
            "terms",
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction
            label="Review and approve"
            onClick={() => onAction?.("Review this quote and tell me what I need to approve")}
            primary
          />
          <CardAction label="Ask a question" onClick={() => onAction?.("Ask about this offer")} />
        </div>
      </Shell>
    );
  if (
    [
      "request",
      "request_status",
      "status_chip",
      "status",
      "execution",
      "execution_status",
    ].includes(type) ||
    typeof data.status === "string" ||
    typeof data.stage === "string"
  )
    return (
      <Shell
        icon={<Clock3 className="size-4 text-primary" />}
        title={title || "Request status"}
        body={body || "This status is linked to the current request."}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-elevated px-2.5 py-1 text-[10.5px] font-medium">
            {readableLabel(data.status ?? data.stage) || "In progress"}
          </span>
          {text(data.eta) ? (
            <span className="text-[11px] text-muted-foreground">ETA {text(data.eta)}</span>
          ) : null}
        </div>
        <DataList
          data={data}
          keys={["requestId", "skill", "provider", "location", "eta", "updatedAt", "evidence"]}
        />
        <div className="mt-3">
          <CardAction label="Open request" href={hrefFor(data)} primary />
        </div>
      </Shell>
    );
  if (["progress", "diagnostics", "diagnostic", "loading"].includes(type))
    return (
      <Shell
        icon={<LoaderCircle className="size-4 animate-spin text-primary" />}
        title={title || "Working"}
        body={body || "Kurukoo is checking supported state. This may take a moment."}
      >
        <DataList data={data} keys={["step", "stage", "progress", "requestId"]} />
      </Shell>
    );
  if (["payment", "payment_state", "approval", "approval_state"].includes(type))
    return (
      <Shell
        icon={<ShieldCheck className="size-4 text-primary" />}
        title={title || "Approval"}
        body={
          body ||
          "A consequential payment or approval step is ready. Kurukoo will not commit it without your approval."
        }
        tone="tint"
      >
        <DataList
          data={data}
          keys={[
            "status",
            "amount",
            "currency",
            "paymentMethod",
            "authorisation",
            "escrow",
            "refund",
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction label="Review" href={hrefFor(data, "/wallet")} primary />
          <CardAction
            label="Ask Kurukoo"
            onClick={() => onAction?.("Explain what I am approving")}
          />
        </div>
      </Shell>
    );
  if (["delivery", "dispatch", "delivery_status", "dispatch_status"].includes(type))
    return (
      <Shell
        icon={<Truck className="size-4 text-primary" />}
        title={title || "Delivery"}
        body={body || "Delivery state returned by the connected fulfilment service."}
      >
        <DataList
          data={data}
          keys={[
            "status",
            "provider",
            "rider",
            "eta",
            "pickup",
            "destination",
            "tracking",
            "evidence",
          ]}
        />
        <div className="mt-3">
          <CardAction label="Open request" href={hrefFor(data)} primary />
        </div>
      </Shell>
    );
  if (["evidence", "result", "evidence_result", "outcome"].includes(type))
    return (
      <Shell
        icon={<FileCheck2 className="size-4 text-primary" />}
        title={title || "Result"}
        body={body || "Evidence returned by the canonical service."}
      >
        <DataList
          data={data}
          keys={["evidence", "source", "verifiedAt", "result", "outcome", "artifactId"]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction label="Open request" href={hrefFor(data)} primary />
          <CardAction
            label="Keep this result"
            onClick={() => onAction?.("Save this result to my context")}
          />
        </div>
      </Shell>
    );
  if (["topic", "topic_card"].includes(type))
    return (
      <Shell
        icon={<MessageCircle className="size-4 text-primary" />}
        title={title || "Topic"}
        body={body || "Community context. It can inform a request but is not fulfilment proof."}
      >
        <DataList data={data} keys={["category", "type", "location", "replyCount", "provenance"]} />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction
            label="Discuss in Chat"
            onClick={() => onAction?.(`Use this Topic as context: ${title}`)}
            primary
          />
        </div>
      </Shell>
    );
  if (["opportunity", "opportunity_card"].includes(type))
    return (
      <Shell
        icon={<Zap className="size-4 text-primary" />}
        title={title || "Opportunity"}
        body={body}
      >
        <DataList data={data} keys={["location", "category", "status", "createdAt", "source"]} />
        <div className="mt-3">
          <CardAction
            label={text(data.ctaText, "Explore opportunity")}
            href={text(data.ctaLink) || hrefFor(data, "/explore")}
            primary
          />
        </div>
      </Shell>
    );
  if (["memory", "memory_card", "memory_action"].includes(type))
    return (
      <Shell
        icon={<Zap className="size-4 text-primary" />}
        title={title || "Saved context"}
        body={body || "Owner-scoped context Kurukoo can use when appropriate."}
      >
        <DataList
          data={data}
          keys={["field", "value", "source", "confidence", "observedAt", "expiresAt"]}
        />
        <div className="mt-3">
          <CardAction label="Review memory" href="/memory" primary />
        </div>
      </Shell>
    );
  if (["agent", "agent_goal", "agent_goal_card"].includes(type))
    return (
      <Shell
        icon={<Zap className="size-4 text-primary" />}
        title={title || "Agent goal"}
        body={body || "A bounded follow-up goal running with your controls."}
      >
        <DataList
          data={data}
          keys={["status", "goal", "schedule", "attention", "conversationId"]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <CardAction label="Open Agent goals" href="/agents" primary />
          <CardAction
            label="Continue in Chat"
            onClick={() => onAction?.("Continue this agent goal")}
          />
        </div>
      </Shell>
    );
  if (["error", "recovery", "failed"].includes(type) || data.error)
    return (
      <Shell
        icon={<ShieldCheck className="size-4 text-destructive" />}
        title={title || "Needs attention"}
        body={body || text(data.error, "Kurukoo could not complete the last step.")}
        tone="danger"
      >
        <div className="flex flex-wrap gap-2">
          <CardAction
            label="Try again"
            onClick={() => onAction?.(text(data.retryText, "Try that again"))}
            primary
          />
          <CardAction
            label="Ask for another route"
            onClick={() => onAction?.("Suggest another way to complete this")}
          />
        </div>
      </Shell>
    );
  if (type === "referral")
    return (
      <Shell
        icon={<Zap className="size-4 text-primary" />}
        title="Referral"
        body={body || "Continue through the canonical referral surface."}
      >
        <CardAction label="Open referral" href={text(data.destination, "/explore")} primary />
      </Shell>
    );
  return null;
}

export function Message({
  message,
  onAction,
}: {
  message: MessageModel;
  onAction?: (text: string) => void;
}) {
  const you = message.role === "you";
  return (
    <div className={cn("flex", you ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] text-[15px] leading-relaxed",
          you ? "rounded-2xl rounded-br-md bg-elevated px-4 py-2.5" : "text-foreground",
        )}
      >
        {message.text}
        {!you && message.progressStage && !message.text ? (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {readableLabel(message.progressStage) || "Working"}
          </div>
        ) : null}
        {!you && message.cardData ? <ChatCard data={message.cardData} onAction={onAction} /> : null}
      </div>
    </div>
  );
}
export function actionClass(variant: "quiet" | "primary" = "quiet") {
  return cn(
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors",
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-border hover:bg-elevated",
  );
}
export function Action({
  children,
  onClick,
  variant = "quiet",
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "quiet" | "primary";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={actionClass(variant)}>
      {children}
    </button>
  );
}
export function Progress({ steps }: { steps: WorkItem["steps"] }) {
  return (
    <ol className="mt-4 space-y-2">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2.5 text-[14px]">
          <span
            className={cn(
              "grid size-[18px] shrink-0 place-items-center rounded-full border",
              s.done ? "border-transparent bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {s.done ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
          <span className={cn(s.done && "text-muted-foreground")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
export function WorkItemCard({
  item,
  onAdvance,
}: {
  item: WorkItem;
  onAdvance?: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[15.5px] font-medium">{item.title}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{item.detail}</p>
        </div>
        <Status stage={item.stage} />
      </div>
      <Progress steps={item.steps} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.stage !== "done" && onAdvance ? (
          <Action
            variant={item.stage === "needs_you" ? "primary" : "quiet"}
            onClick={() => onAdvance(item.id)}
          >
            {item.stage === "needs_you" ? "Confirm and finish" : "Continue"}
          </Action>
        ) : null}
        <Link
          to="/chat"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
        >
          <MessageCircle className="size-3.5" />
          Continue conversation
        </Link>
      </div>
    </div>
  );
}
export function Result({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[15.5px] font-medium">{title}</p>
      <p className="mt-1 text-[14px] text-muted-foreground">{body}</p>
    </div>
  );
}
export function IntegrationGap({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Not available yet · </span>
      {children}
    </p>
  );
}
