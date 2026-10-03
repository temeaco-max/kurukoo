import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Phone } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app-shell";
import { VideoCard } from "@/components/kurukoo/cards";
import { Action, IntegrationGap, actionClass } from "@/components/kurukoo/primitives";
import {
  Avatar,
  FollowButton,
  Rows,
  SaveButton,
  SectionHeader,
  ShareButton,
  StatTile,
} from "@/components/kurukoo/ui";
import { entityById, videos } from "@/lib/kurukoo-demo";
import { useKurukoo } from "@/lib/kurukoo-store";

const kindLabel = {
  provider: "Network",
  business: "Business",
  creator: "Creator",
  person: "Person",
  partner: "Partner",
  contributor: "Contributor",
} as const;

export const Route = createFileRoute("/profile/$entityId")({
  head: () => ({
    meta: [
      { title: "Profile — Kurukoo" },
      { name: "description", content: "A person, network member, business or creator on Kurukoo." },
      { property: "og:title", content: "Profile — Kurukoo" },
      {
        property: "og:description",
        content: "Follow, message or start work with someone on Kurukoo.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { entityId } = Route.useParams();
  const entity = entityById(entityId);
  const { send } = useKurukoo();

  if (!entity) {
    return (
      <>
        <PageHeader title="Profile" />
        <EmptyState title="Not found" body="This profile isn't part of the preview directory." />
        <Link to="/discover" className="mt-4 inline-block text-[14px] underline">
          Back to Explore
        </Link>
      </>
    );
  }

  const theirVideos = videos.filter((v) => v.creatorId === entity.id);

  return (
    <>
      <header className="flex items-start gap-4 pb-6 pt-2">
        <Avatar name={entity.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-[24px] font-semibold">
            {entity.name}
            {entity.verified ? (
              <BadgeCheck className="size-5 text-primary" aria-label="Verified" />
            ) : null}
          </h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">{entity.tagline}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {kindLabel[entity.kind]}
            {entity.location ? ` · ${entity.location}` : ""}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FollowButton />
        <Link to="/messages" className={actionClass()}>
          Message
        </Link>
        <Link to="/calls" className={actionClass()}>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-4" /> Voice
          </span>
        </Link>
        <Link to="/">
          <Action variant="primary" onClick={() => send(`I need help from ${entity.name}.`)}>
            Start a request
          </Action>
        </Link>
        <SaveButton />
        <ShareButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Followers" value={(entity.followers ?? 0).toLocaleString()} />
        <StatTile
          label="Rating"
          value={entity.rating ? `${entity.rating} / 5` : "—"}
          note={entity.rating ? "Community rating" : "Not rated yet"}
        />
        <StatTile label="Response" value="—" note="Not measured yet" />
      </div>

      {entity.services?.length ? (
        <section className="mt-8">
          <SectionHeader title="Services" subtitle="What they offer." />
          <Rows>
            {entity.services.map((s) => (
              <li key={s} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-[15px]">{s}</span>
                <Link
                  to="/"
                  className="text-[13.5px] underline"
                  onClick={() => send(`${s} with ${entity.name}.`)}
                >
                  Request
                </Link>
              </li>
            ))}
          </Rows>
        </section>
      ) : null}

      {theirVideos.length ? (
        <section className="mt-8">
          <SectionHeader title="Content" />
          <div className="grid gap-4 sm:grid-cols-2">
            {theirVideos.map((v) => (
              <VideoCard key={v.id} video={v} creatorName={entity.name} />
            ))}
          </div>
        </section>
      ) : null}

      <IntegrationGap>
        Availability and ratings are shown here only when Kurukoo has reliable information.
      </IntegrationGap>
    </>
  );
}
