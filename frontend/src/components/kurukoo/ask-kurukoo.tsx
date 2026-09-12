import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AskKurukooProps = {
  prompt: string;
  children?: ReactNode;
  className?: string;
};

export function AskKurukoo({ prompt, children = "Ask Kurukoo", className }: AskKurukooProps) {
  const workHandoff = /verified request|provider|business|work with|fulfil|fulfill|service/i.test(prompt);
  const workPrompt = `Bring this into Work: ${prompt} Preserve the discovered entity, source and evidence as context. Verify current capability and availability before commitment, and do not invent price, acceptance, payment or completion.`;
  return (
    <span className="inline-flex flex-wrap gap-2">
      <Link
        to="/chat"
        search={{ query: prompt } as never}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-elevated",
          className,
        )}
      >
        <MessageCircle className="size-3.5" />
        {children}
      </Link>
      {workHandoff ? (
        <Link
          to="/chat"
          search={{ query: workPrompt } as never}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Bring into Work
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </span>
  );
}
