import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { MarketingPage } from "@/components/kurukoo/marketing";

export const Route = createFileRoute("/blog/the-call-that-gets-things-moving")({
  head: () => ({
    meta: [
      { title: "The Call That Gets Things Moving — Kurukoo" },
      {
        name: "description",
        content: "The story behind Kurukoo, told through voice, movement, context, trust and the places where real life happens.",
      },
      { property: "og:title", content: "The Call That Gets Things Moving — Kurukoo" },
      {
        property: "og:description",
        content: "A rhyming story about the idea behind Kurukoo and the world it is being built to move.",
      },
    ],
  }),
  component: StoryPage,
});

const stanzas = [
  [
    "There was a world full of things to do, with plans half-made and mornings due,",
    "A message to send, a place to find, a promise to keep, a worry in mind too kind to leave behind.",
  ],
  [
    "People could search and people could chat, but searching was scattered and chatting stopped at that,",
    "So Kurukoo began with a simpler view: say what needs doing, and let it help carry it through.",
  ],
  [
    "It took its name from a bird with a voice that can cross the woodland and make its presence a choice,",
    "A call with a character, clear and bright, a sound that can gather attention and turn an ordinary moment toward light.",
  ],
  [
    "Not because every trait should become a brand, nor because nature obeys a human command,",
    "But because five qualities rang true: a distinctive call, sharp timing, movement, adaptation, and finding a way through.",
  ],
  [
    "First came the call: Croon was born, a place where a thought could arrive before dawn,",
    "Type it, speak it, say Hey Kurukoo, and let the request become something the system can know.",
  ],
  [
    "Then came the listening, the pause before plan, to understand the person, the place and the span,",
    "For context is more than a word in a line; it is what makes the right next step feel right in time.",
  ],
  [
    "Kurukoo would ask when asking was wise, remember what mattered, and notice surprise,",
    "It would keep trusted context close at hand, while permission stayed with the person who gave the command.",
  ],
  [
    "Then came the Thicket, where questions could grow, where stories and useful local knowledge could flow,",
    "A place for people, creators and providers to share what they know, without pretending a discussion is proof that a service will go.",
  ],
  [
    "From Thicket to Explore, from Explore to Nearby, Kurukoo could look at the world with a practical eye,",
    "Finding options, places and people in view, while keeping evidence beside every claim it knew.",
  ],
  [
    "Nearby was not merely a map with a pin; it was the living world the request might begin in,",
    "A repairer, a restaurant, a ride or a place, brought closer to the person who needed a real-world way through the maze.",
  ],
  [
    "And when a choice appeared, Kurukoo would not pretend that choosing was the same as consent,",
    "It could explain what would happen next, then wait for the person before anything consequential was sent.",
  ],
  [
    "For trust was the measure, and consent was the door, not a hidden switch behind some technical floor,",
    "The person could say yes, say no, change the route, or stop the action before it went out.",
  ],
  [
    "Then Actions became the trail of what moved, what waited, what finished, what needed to be proved,",
    "Not a pile of tasks for a person to maintain, but a clear view of what Kurukoo was doing and what remained.",
  ],
  [
    "A provider could answer, a business could join, a creator could teach, a contributor could add their voice to the line,",
    "Agents could handle bounded pieces of the work, while people kept the authority that makes trust real by design.",
  ],
  [
    "A message could travel, a calendar could align, a document could form, a useful comparison could shine,",
    "But where a connection was missing, Kurukoo would say so; it would never paint a false road where no road could go.",
  ],
  [
    "It learned the value of timing from seasons that turn, of knowing when to wait and when to return,",
    "For a good assistant is not always the fastest to act; sometimes the smartest move is to pause, check and come back.",
  ],
  [
    "It learned the value of movement from journeys that cross, from changing direction without treating change as a loss,",
    "If one route failed, another could be found; if the first answer fell short, the search could continue on sounder ground.",
  ],
  [
    "It learned adaptation from environments that shift, from reading the moment and adjusting the lift,",
    "A request could start as a question, then become a plan, then become an action when the right evidence began to land.",
  ],
  [
    "It learned specialized skill does not mean pretending to know all, so it could hand work to the right people when needed to call,",
    "The strength was not one giant trick or one mind alone; it was knowing what Kurukoo could do, and who could take it home.",
  ],
  [
    "And so there was Perch, a personal place, where memory, active work and trust could have space,",
    "A quiet home for the things in motion, where the person could see the whole path without losing their own notion.",
  ],
  [
    "There were creators and businesses, providers nearby, and people with knowledge who could help a need fly,",
    "There were topics, opportunities, messages and more, all connected when usefulness opened the door.",
  ],
  [
    "There was a place for discovery, a place for the voice, a place for the work and a place for the choice,",
    "But beneath every name was one promise kept true: make the next useful thing easier to do.",
  ],
  [
    "Kurukoo did not promise magic, nor claim every road would bend,",
    "It promised something better: honesty about the journey, and evidence at the end.",
  ],
  [
    "So when someone says, " + '"' + "Hey Kurukoo," + '"' + " the answer is not merely a sound,",
    "It is a signal that something matters, that a person has a need, and that help should look around.",
  ],
  [
    "From Croon to Thicket, from Nearby to choice, from consent to Actions, the system finds its voice,",
    "From Perch back to life, from question to done, Kurukoo keeps moving until the useful work has begun.",
  ],
  [
    "And that is the story, simple and true: the world has enough places that tell you what to do,",
    "Kurukoo wants to be the place where you tell it what needs doing, and it helps make that happen for you.",
  ],
];

function StoryPage() {
  return (
    <MarketingPage>
      <article className="mx-auto w-full max-w-3xl pb-14">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Blog
        </Link>
        <header className="mt-6 border-b border-border pb-8">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">Kurukoo · Our story</p>
          <h1 className="mt-3 font-serif text-[44px] leading-[1.01] tracking-[-0.05em] md:text-[58px]">The Call That Gets Things Moving</h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            A story about why Kurukoo listens, remembers, finds a way, asks before it acts, and keeps moving until useful work has somewhere real to land.
          </p>
        </header>
        <div className="mt-10 space-y-8">
          {stanzas.map((lines, index) => (
            <section key={index} className="space-y-2">
              {lines.map((line) => <p key={line} className="font-serif text-[18px] leading-[1.65] tracking-[-0.01em] md:text-[20px]">{line}</p>)}
            </section>
          ))}
        </div>
        <footer className="mt-12 border-t border-border pt-7">
          <div className="flex flex-wrap gap-2">
            <AskKurukoo prompt="Tell me more about the ideas behind Kurukoo and how Croon, Thicket, Perch, Actions and Nearby fit together." />
            <Link to="/explore" className="inline-flex min-h-9 items-center gap-1.5 border border-border px-3 text-[12px] font-medium hover:bg-elevated">Explore <ArrowUpRight className="size-3.5" /></Link>
            <Link to="/blog" className="inline-flex min-h-9 items-center gap-1.5 px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground">More from the journal</Link>
          </div>
        </footer>
      </article>
    </MarketingPage>
  );
}
