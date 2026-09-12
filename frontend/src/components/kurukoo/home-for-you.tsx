import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getKurukooRole, KURUKOO_ROLE_STORAGE_KEY, KURUKOO_ROLES, type KurukooRoleId } from "@/lib/kurukoo-personas";

export function HomeForYou() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [roleId, setRoleId] = useState<KurukooRoleId>("seeker");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setRoleId(getKurukooRole().id); setReady(true); };
    sync();
    window.addEventListener("kurukoo-role-changed", sync);
    return () => window.removeEventListener("kurukoo-role-changed", sync);
  }, []);
  const role = useMemo(() => getKurukooRole(roleId), [roleId]);
  if (pathname !== "/workspace") return null;

  function changeRole(next: KurukooRoleId) {
    setRoleId(next);
    window.localStorage.setItem(KURUKOO_ROLE_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("kurukoo-role-changed", { detail: { role: next } }));
  }

  return <section className="overflow-hidden border-y border-border/80 bg-background">
    <div className="flex flex-col gap-5 px-1 py-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace context</p>
        <h2 className="mt-2 text-[30px] font-semibold leading-[1.02] tracking-[-0.045em]">Set the way you want Kurukoo to work with you.</h2>
        <p className="mt-2.5 max-w-xl text-[13px] leading-6 text-muted-foreground">Your workspace adapts to the things you do. These shortcuts change with your role while the core Kurukoo experience stays simple.</p>
      </div>
      <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground"><span>Role</span><select aria-label="Choose your Kurukoo role" value={ready ? roleId : "seeker"} onChange={e => changeRole(e.target.value as KurukooRoleId)} className="min-h-9 rounded-lg border border-border bg-surface px-3 text-[11px] font-medium text-foreground outline-none focus:border-foreground/30">{KURUKOO_ROLES.map(item => <option key={item.id} value={item.id}>{item.shortTitle}</option>)}</select></label>
    </div>
    <div className="grid border-t border-border/70 sm:grid-cols-3">
      {role.actions.map((action, index) => <Link key={action.title} to={action.to as never} className="group border-b border-border/70 px-4 py-5 transition-colors hover:bg-surface sm:border-b-0 sm:border-r last:border-r-0"><div className="flex items-start justify-between gap-4"><span className="text-[10px] tabular-nums text-muted-foreground">0{index + 1}</span><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-8 text-[13px] font-semibold tracking-[-0.01em]">{action.title}</p><p className="mt-1.5 max-w-xs text-[11.5px] leading-5 text-muted-foreground">{action.detail}</p></Link>)}
    </div>
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10.5px] text-muted-foreground">Conversation, work and trusted context stay connected.</p><div className="flex items-center gap-4 text-[10.5px] font-medium"><Link to="/chat" className="inline-flex items-center gap-1 hover:text-primary">Conversation <MessageCircle className="size-3.5" /></Link><Link to="/work" className="inline-flex items-center gap-1 hover:text-primary">Work <ArrowUpRight className="size-3.5" /></Link></div></div>
  </section>;
}
