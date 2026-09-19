import { Link } from "@tanstack/react-router";
import {
  Bell,
  Brain,
  Briefcase,
  CheckCircle2,
  ListChecks,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Ellipsis,
  ExternalLink,
  Home,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Moon,
  Search,
  ShoppingCart,
  Sparkles,
  Sun,
  Tags,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

// Keep canonical Perch rail icon imports explicit for Vite module evaluation.
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useKurukoo } from "@/lib/kurukoo-store";
import { fetchAuthenticatedAd, type AuthenticatedAd } from "@/lib/kurukoo-api";
import { ContextualTrustedRail } from "@/components/contextual-trusted-rail";
import { ReferralCard } from "@/components/kurukoo/referral-card";
import { PresenceRadarControl } from "@/components/kurukoo/presence-radar-control";
import { logoutKurukoo } from "@/lib/kurukoo-auth";

const KURUKOO_LOGO_SRC =
  "https://raw.githubusercontent.com/temeaco-max/kurukoo/ca35abf26b6b07fa234f6b986bd7a52e4e718f86/public/assets/brand/logo-icon.png";
export function KurukooLogo({ className = "size-6" }: { className?: string }) {
  return (
    <img
      src={KURUKOO_LOGO_SRC}
      alt="Kurukoo"
      width={32}
      height={38}
      className={cn("object-contain", className)}
    />
  );
}
function useHeaderEnvironment() {
  const [environment, setEnvironment] = useState({ temperature: "--°", location: "London", date: "" });
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fallback = timezone.split("/").pop()?.replace(/_/g, " ") || "Local";
    setEnvironment((value) => ({ ...value, location: fallback, date: new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date()) }));
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m&temperature_unit=celsius`,
          );
          if (!response.ok) return;
          const data = (await response.json()) as { current?: { temperature_2m?: number } };
          if (typeof data.current?.temperature_2m === "number") {
            setEnvironment((value) => ({ ...value, temperature: `${Math.round(data.current!.temperature_2m)}°` }));
          }
        } catch {
          /* weather is enhancement-only; keep the local fallback */
        }
      },
      () => undefined,
      { maximumAge: 300000, timeout: 5000 },
    );
  }, []);
  return environment;
}

export function useProfileName() {
  const [name, setName] = useState("Ada");
  useEffect(() => {
    const read = () => {
      const value = localStorage.getItem("kurukoo-profile-name")?.trim();
      if (value) setName(value);
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("kurukoo-profile-updated", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("kurukoo-profile-updated", read);
    };
  }, []);
  return name;
}
export function PageHeader({
  title,
  description,
  subtitle,
  eyebrow,
  action,
}: {
  title?: string;
  description?: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4 border-b border-border/70 pb-5">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          {eyebrow ?? "Kurukoo OS"}
        </p>
        {title ? (
          <h1 className="mt-1.5 text-[28px] font-bold leading-[1.08] tracking-[-0.03em]">
            {title}
          </h1>
        ) : null}
        {(description ?? subtitle) ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-muted-foreground">
            {description ?? subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
export function EmptyState({
  title,
  body,
  description,
}: {
  title: string;
  body?: string;
  description?: string;
}) {
  const message = body ?? description;
  return (
    <div className="rounded-2xl border border-dashed border-border bg-elevated/30 px-5 py-8 text-center">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {message ? (
        <p className="mx-auto mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
function ChatVoiceIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 ${className}`}>
      <MessageCircle className="absolute inset-0 size-full" strokeWidth={1.8} />
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[1px]">
        <i className="h-[5px] w-px rounded-full bg-current" />
        <i className="h-[8px] w-px rounded-full bg-current" />
        <i className="h-[5px] w-px rounded-full bg-current" />
      </span>
    </span>
  );
}

const nav = [
  { to: "/perch", label: "Field", icon: LayoutDashboard, color: "text-muted-foreground" },
  { to: "/chat", label: "Chat", icon: MessageCircle, color: "text-muted-foreground" },
  { to: "/work", label: "Requests", icon: ListChecks, color: "text-muted-foreground" },
  { to: "/tasks", label: "Tasks", icon: CheckCircle2, color: "text-muted-foreground" },
  { to: "/memory", label: "Memory", icon: Brain, color: "text-muted-foreground" },
  { to: "/discover", label: "Nearby", icon: MapPin, color: "text-muted-foreground" },
] as const;
const more = [
  { to: "/settings", label: "Settings", icon: Wallet },
  { to: "/activity", label: "Activity", icon: Bell },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/artifacts", label: "Artifacts", icon: Tags },
  { to: "/connect", label: "Connect", icon: Users },
  { to: "/network", label: "Network", icon: Users },
  { to: "/capabilities", label: "Capabilities", icon: Sparkles },
  { to: "/providers", label: "Providers", icon: Users },
  { to: "/businesses", label: "Businesses", icon: Briefcase },
  { to: "/creators", label: "Creators", icon: Sparkles },
  { to: "/advertising", label: "Advertising", icon: Zap },
] as const;
const mobileNav = nav.slice(0, 5);

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("kurukoo-theme");
    const value = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
  }, []);
  return (
    <button
      type="button"
      aria-label={dark ? "Use light appearance" : "Use dark appearance"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("kurukoo-theme", next ? "dark" : "light");
      }}
      className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
function HeaderSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = q.trim();
    window.location.href = value ? `/explore?query=${encodeURIComponent(value)}` : "/explore";
    setOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Search Kurukoo"
        title="Search Kurukoo"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
      >
        <Search className="size-[18px]" strokeWidth={1.8} />
      </button>
      {open ? (
        <form
          onSubmit={submit}
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(390px,calc(100vw-40px))] rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-lift)]"
        >
          <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              aria-label="Search Kurukoo"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask Kurukoo anything..."
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            <kbd className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[9px] text-muted-foreground lg:inline">
              ⌘ K
            </kbd>
          </div>
        </form>
      ) : null}
    </div>
  );
}
function RailAd({ campaign }: { campaign: AuthenticatedAd | null }) {
  if (!campaign) return null;
  return (
    <a
      href={campaign.clickUrl}
      rel="nofollow"
      className="mt-auto block overflow-hidden rounded-2xl border border-border bg-elevated/55 hover:bg-elevated"
    >
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {campaign.disclosure}
          </p>
          <ExternalLink className="size-3 text-muted-foreground" />
        </div>
        {campaign.image ? (
          <img
            src={campaign.image}
            alt=""
            loading="lazy"
            width="176"
            height="70"
            className="mt-2 h-14 w-full rounded-xl object-cover"
          />
        ) : null}
        <p className="mt-2 text-[11.5px] font-semibold leading-4">{campaign.title}</p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{campaign.desc}</p>
        <span className="mt-2 inline-flex text-[10.5px] font-medium">{campaign.ctaText}</span>
      </div>
    </a>
  );
}
function Header() {
  const name = useProfileName();
  const environment = useHeaderEnvironment();
  const { notifications } = useKurukoo();
  const unread = notifications.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const logout = async () => {
    setOpen(false);
    await logoutKurukoo();
    window.location.href = "/";
  };
  const headerItems = [
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/discover", label: "Nearby", icon: MapPin },
    { to: "/topics", label: "Topics", icon: Tags },
    { to: "/wallet", label: "Wallet", icon: Wallet },
    { to: "/cart", label: "Cart", icon: ShoppingCart },
  ];
  return (
    <header className="kurukoo-os-header sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="relative flex h-[50px] items-center px-5 md:px-7 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Kurukoo home">
          <KurukooLogo />
          <span className="hidden text-[17px] font-semibold tracking-[-0.025em] sm:inline">
            Kurukoo
          </span>
        </Link>
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 md:flex">
          <Link
            to="/"
            aria-label="Go to Kurukoo home"
            title="Kurukoo home"
            className="grid size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-elevated"
          >
            <Home className="size-[18px]" strokeWidth={1.8} />
          </Link>
          <HeaderSearch />
          {headerItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
            </Link>
          ))}
          <Link
            to="/activity"
            aria-label={unread ? `${unread} unread notifications` : "Notifications"}
            title="Notifications"
            className="relative grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
          >
            <Bell className="size-[18px]" />
            {unread ? (
              <span className="absolute right-[5px] top-[4px] grid min-w-2.5 place-items-center rounded-full bg-destructive px-1 text-[7px] text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-2 text-[11px] text-muted-foreground lg:flex">
          </div>
          <PresenceRadarControl />
           <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-elevated"
            >
              <span className="profile-completeness-ring" style={{ "--profile-complete": "50%" } as CSSProperties}>
                <span className="profile-avatar grid size-[34px] place-items-center rounded-full bg-brand-tint text-[12px] font-semibold text-brand-ink">
                  {name.charAt(0).toUpperCase() || "A"}
                  <span className="profile-status-dot is-online" aria-label="Online" />
                </span>
              </span>
              <span className="hidden min-w-0 max-w-[120px] text-left sm:grid">
                <span className="truncate text-[13px] font-medium">{name}</span>
                <span className="text-[9.5px] text-muted-foreground">Personal</span>
              </span>
              <ChevronDown
                className={cn(
                  "hidden size-4 text-muted-foreground transition-transform sm:block",
                  open && "rotate-180",
                )}
              />
            </button>
            {open ? (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-[-13px] top-[calc(100%+8px)] z-50 w-47 rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lift)]"
              >
                <Link
                  role="menuitem"
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Profile
                </Link>
                <Link
                  role="menuitem"
                  to="/agents"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  My Agents
                </Link>
                <Link
                  role="menuitem"
                  to="/contacts"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Contacts
                </Link>
                <Link
                  role="menuitem"
                  to="/messages"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Messages
                </Link>
                <div className="my-1 border-t border-border" />
                <Link
                  role="menuitem"
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Settings
                </Link>
                <Link
                  role="menuitem"
                  to="/subscriptions"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Subscriptions
                </Link>
                <Link
                  role="menuitem"
                  to="/usage"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Usage
                </Link>
                <Link
                  role="menuitem"
                  to="/wallet"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Wallet
                </Link>
                <Link
                  role="menuitem"
                  to="/trust"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Trust
                </Link>
                <Link
                  role="menuitem"
                  to="/advertising"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Advertise
                </Link>
                <Link
                  role="menuitem"
                  to="/help"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-[12.5px] hover:bg-elevated"
                >
                  Help
                </Link>
                <div className="px-1">
                  
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-[12.5px] text-muted-foreground hover:bg-elevated"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-5 pb-3 md:hidden">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q")?.toString().trim() || "";
            window.location.href = value
              ? `/explore?query=${encodeURIComponent(value)}`
              : "/explore";
          }}
        >
          <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              name="q"
              aria-label="Search Kurukoo"
              placeholder="Search Kurukoo"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
        </form>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [trustedOpen, setTrustedOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [ad, setAd] = useState<AuthenticatedAd | null>(null);
  useEffect(() => {
    if (!collapsed)
      void fetchAuthenticatedAd("left-rail")
        .then(setAd)
        .catch(() => setAd(null));
  }, [collapsed]);
  const grid = trustedOpen
    ? collapsed
      ? "md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[76px_minmax(0,1fr)_224px]"
      : "md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_224px]"
    : collapsed
      ? "md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[76px_minmax(0,1fr)]"
      : "md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]";
  return (
    <div className="kurukoo-os-shell min-h-screen overflow-hidden bg-background">
      <Header />
      <div
        className={cn("kurukoo-os-grid h-[calc(100vh-50px)] min-h-0 overflow-hidden md:grid", grid)}
      >
        <aside
          aria-label="OS navigation"
          className={cn(
            "relative z-30 min-h-0 h-full hidden flex-col bg-surface/90 py-0 backdrop-blur md:flex overflow-visible",
            collapsed ? "w-[76px] px-3" : "w-[200px] px-3",
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="absolute right-[-15px] top-5 z-[80] grid size-7 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-[var(--shadow-soft)] hover:bg-elevated"
          >
            {collapsed ? (
              <ChevronRight className="size-[17px]" strokeWidth={1.8} />
            ) : (
              <ChevronLeft className="size-[17px]" strokeWidth={1.8} />
            )}
          </button>
          <nav aria-label="OS navigation" className="scrollbar-none min-h-0 space-y-1 overflow-y-auto pt-5">
            {nav.map(({ to, label, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "bg-elevated font-medium text-foreground" }}
                className={cn(
                  "flex items-center rounded-xl py-2.5 text-[13.5px] leading-5 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                )}
                title={collapsed ? label : undefined}
              >
                {label === "Chat" ? (
                  <ChatVoiceIcon className={cn("size-[18px]", color)} />
                ) : (
                  <Icon className={cn("size-[18px] shrink-0", color)} strokeWidth={1.8} />
                )}{" "}
                {!collapsed && <span>{label}</span>}
              </Link>
            ))}
          </nav>
          {!collapsed ? (
            <>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  aria-controls="kurukoo-more-navigation"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:bg-elevated hover:text-foreground"
                >
                  <span>More</span>
                  <Ellipsis className="size-[17px]" strokeWidth={1.8} />
                </button>
                {moreOpen ? (
                  <nav
                    id="kurukoo-more-navigation"
                    aria-label="More navigation"
                    className="scrollbar-none mt-1 max-h-[220px] space-y-1 overflow-y-auto overscroll-contain pr-1"
                  >
                    {more.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        activeProps={{ className: "bg-elevated font-medium text-foreground" }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] leading-5 text-muted-foreground hover:bg-elevated hover:text-foreground"
                      >
                        <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </nav>
                ) : null}
              </div>
              <div className="mt-4">
                <ReferralCard />
              </div>
              <RailAd campaign={ad} />
            </>
          ) : null}
          {collapsed ? (
            <div className="mt-auto shrink-0 px-1 pb-4 pt-4">
              <ReferralCard collapsed />
            </div>
          ) : null}
        </aside>
        <main className="min-h-0 h-full w-full min-w-0 overflow-y-auto overscroll-contain pb-16 md:pb-0">
          <div className="mx-auto min-w-0 max-w-[1600px] px-5 py-6 md:px-7 lg:px-8">{children}</div>
        </main>
        {trustedOpen ? (
          <ContextualTrustedRail open={trustedOpen} onOpenChange={setTrustedOpen} />
        ) : (
          <button
            type="button"
            onClick={() => setTrustedOpen(true)}
            aria-label="Open trusted context"
            title="Open trusted context"
            className="fixed right-2 top-1/2 z-30 grid size-9 -translate-y-1/2 place-items-center rounded-l-xl border border-border bg-surface text-muted-foreground shadow-[var(--shadow-soft)]"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <nav
          aria-label="Mobile OS navigation"
          className="fixed inset-x-0 bottom-0 z-[70] grid grid-cols-5 border-t border-border bg-background/95 px-2 py-1.5 backdrop-blur md:hidden"
        >
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] text-muted-foreground [&.active]:bg-elevated [&.active]:font-medium [&.active]:text-foreground"
              activeProps={{ className: "active" }}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              <span>{label === "Conversation" ? "Chat" : label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
