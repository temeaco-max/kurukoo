import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Gift, Link2, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { AskKurukoo } from "@/components/kurukoo/ask-kurukoo";
import { FAQSection } from "@/components/kurukoo/faq-section";
import { actionClass } from "@/components/kurukoo/primitives";
import { Panel } from "@/components/kurukoo/ui";

type FAQItem = { question: string; answer: string };

type RoleLandingProps = {
  eyebrow?: string;
  title: string;
  intro: string;
  whatKurukooIs: string;
  participation: string[];
  benefits: string[];
  features: string[];
  useCases: string[];
  referral: string;
  offer: string;
  joinPrompt: string;
  primaryLabel?: string;
  primaryTo?: string;
};

const roleStories: Record<string, { label: string; primary: string }> = {
  people: { label: "People", primary: "Get things done" },
  providers: { label: "Providers", primary: "Get relevant demand" },
  businesses: { label: "Businesses", primary: "Become discoverable + executable" },
  creators: { label: "Creators", primary: "Turn attention into discovery/action" },
  partners: { label: "Partners", primary: "Build business around Kurukoo" },
  contributors: { label: "Contributors", primary: "Contribute + earn/advance" },
  advertisers: { label: "Advertisers", primary: "Reach active intent" },
  "local agents": { label: "Local Agents", primary: "Execute locally + earn" },
  ambassadors: { label: "Ambassadors", primary: "Grow Kurukoo through trusted referrals" },
};

const roleFaqs: Record<string, FAQItem[]> = {
  People: [
    ["What is Kurukoo?", "Kurukoo is an AI execution layer for real life. You describe the outcome you need and Kurukoo helps understand it, find relevant options and coordinate next steps with your permission."],
    ["What can I actually ask Kurukoo to do?", "You can start with everyday outcomes such as finding a provider, choosing somewhere nearby, organising work, setting a reminder, discovering an opportunity or coordinating a supported request."],
    ["Do I have to know exactly what I want?", "No. Start with the outcome or problem. Kurukoo can help clarify what matters, what is known, what is uncertain and what decision is needed next."],
    ["Can Kurukoo find people or businesses for me?", "Where relevant discovery data exists, Kurukoo can surface people, providers, businesses, places, offers, events and other useful options."],
    ["How does Kurukoo decide what to recommend?", "Recommendations should be grounded in available context and evidence such as capability, location, relevance, trust signals and—where available—price or availability evidence."],
    ["Can I see evidence before I agree?", "Yes. Where evidence exists, Kurukoo should distinguish confirmed facts such as a quote or availability from estimates, community context or examples."],
    ["When does Kurukoo ask for my permission?", "Consequential actions such as committing to a booking, purchase, payment or external action require the appropriate consent before Kurukoo proceeds."],
    ["What information does Kurukoo remember?", "Kurukoo can retain useful context through its memory system when appropriate. You remain in control of the information and can manage memory through the OS."],
    ["What happens when Kurukoo cannot complete something?", "It should tell you what it established, what remains uncertain and what you can do next rather than presenting an unconfirmed outcome as completed."],
    ["Can I participate in another role too?", "Yes. People are the entry point to the network and can also become providers, creators, partners, contributors, advertisers, Local Agents or Ambassadors where eligible."],
  ],
  Providers: [
    ["What counts as a provider?", "A provider is a person or organisation that can supply a real service, product, capability or other fulfilment to someone through Kurukoo."],
    ["Can I be an individual provider?", "Yes. Your profile can represent the skills, services, location and availability you are actually able to offer."],
    ["Can I offer a service from a physical location or travel to customers?", "Yes. Kurukoo can represent stationary and mobile providers, subject to the capability, service area and location information available for matching."],
    ["How does Kurukoo bring me relevant demand?", "When a request is relevant to what you offer, discovery and matching can surface your profile or service. Kurukoo does not imply guaranteed work or demand."],
    ["How are requests presented to me?", "Supported requests can appear with the context needed to decide whether the work fits. The provider retains control over whether to accept, quote or proceed."],
    ["Can I choose when I am available?", "Where availability is supported, you can provide the periods, service area or status that Kurukoo can use for matching. Go Live is available only when the account is eligible."],
    ["Can I set prices and quotes?", "Where the service flow supports pricing, you can provide the applicable price or quote. A quote remains distinct from confirmed payment or completed fulfilment."],
    ["How do ratings, reviews and verification work?", "Verification states and service ratings can provide trust signals. Kurukoo should show the strength and status of the underlying evidence rather than inventing certainty."],
    ["What happens if a customer disputes something?", "The applicable request, evidence, communication and dispute workflow should be used. A dispute is not silently treated as a completed outcome."],
    ["Can I have an AI agent representing my services?", "Yes, where the agent capability is enabled. An AI agent such as Emeka AI can represent defined services and permissions while the underlying provider truth remains authoritative."],
    ["How do payments and fees work?", "Commercial terms depend on the supported workflow and live market integrations. Kurukoo should show confirmed pricing, fees and payment state before commitment and never imply settlement that has not occurred."],
  ],
  Businesses: [
    ["What is the difference between a business and a provider?", "A business represents an organisation and its locations, products, services and people. A provider can be an individual or organisation offering a specific capability."],
    ["How does my business become discoverable?", "Accurate business information, capabilities, location or service area and operating details give Kurukoo useful context for matching a request to your business."],
    ["Can people discover my business through natural-language requests?", "Yes, where your business information is available to the discovery system and is relevant to what someone is asking Kurukoo to accomplish."],
    ["Can a business have multiple locations?", "The business model can represent multiple locations or service areas where the underlying data supports them."],
    ["Can Kurukoo recommend my products or services?", "Relevant discovery can surface your products or services when they match a person's intent. Paid placement remains distinct from independent fulfilment recommendations."],
    ["Can Kurukoo generate enquiries?", "Relevant requests can create discovery and contact opportunities, but Kurukoo should never promise a volume of enquiries or customers that has not actually occurred."],
    ["Can customers contact us through Kurukoo?", "Where messaging, calls or contact capability is enabled, Kurukoo can help connect customers with the business or its designated provider."],
    ["Can I operate without building another consumer app?", "Yes. Kurukoo can act as a conversational access layer to existing business capability rather than requiring you to build a separate consumer app."],
    ["Can my business deploy an AI agent?", "Yes. A business AI agent can represent defined capabilities within explicit permissions, rules and escalation paths. It should not invent availability, prices or outcomes."],
    ["How do verification and reviews differ from advertising?", "Verification is a trust signal, reviews reflect experience, and advertising is paid placement. Sponsored placement must remain clearly disclosed and separate from fulfilment proof."],
    ["Can my team manage the business?", "The business workspace can support team, billing, requests and customer coordination where those capabilities are enabled for the account."],
  ],
  Creators: [
    ["What can creators do on Kurukoo?", "Creators can publish useful content, build an audience, help people discover products, services and opportunities, and connect attention with real-world action."],
    ["Can I publish video?", "Yes. Kurukoo's creator and Watch surfaces support video-oriented discovery alongside other eligible creator content."],
    ["Can people discover my content?", "Content can be surfaced through creator discovery, following, Topics and relevant Kurukoo surfaces, subject to the ranking and content systems available."],
    ["Can content connect to products, services or opportunities?", "Yes. A creator can help someone move from discovery to a product, service, provider, business or other useful action where the connection exists."],
    ["Can creators earn?", "Kurukoo can support qualifying commercial, campaign or referral activity where a programme explicitly provides it. Views or posts alone do not imply earnings."],
    ["How do creators get discovered?", "Useful content can be discovered through creator profiles, Watch, Topics, following and other relevant surfaces. Example metrics are not treated as live performance unless recorded by the system."],
    ["Can creators recommend businesses or providers?", "Yes, where the relationship and content are permitted. Commercial relationships and paid placements must be disclosed appropriately."],
    ["Can creators also become Ambassadors?", "Yes, where eligible. Creators build useful reach; Ambassadors grow trusted adoption through qualifying referrals."],
    ["Can I refer other creators?", "Where the referral programme supports it, eligible creator referrals can be attributed through Kurukoo's canonical referral system and its current qualification rules."],
    ["What analytics will I receive?", "The creator workspace can expose analytics and activity signals actually available to your account. Any illustrative metrics are clearly labelled as examples."],
    ["What content rules apply?", "Creators must follow Kurukoo's content, safety, advertising and intellectual-property rules. Paid promotion must be disclosed and misleading claims are not acceptable."],
  ],
  Partners: [
    ["What is a Kurukoo Partner?", "A Partner is a person or organisation that extends Kurukoo through services, integrations, implementation, referrals, distribution or other useful capabilities."],
    ["Who should become a Partner?", "Partners can be individuals, agencies, companies or specialists whose capabilities can create useful outcomes around Kurukoo."],
    ["Can an individual become a Partner?", "Yes, where the partner programme supports the proposed activity. Partner status is based on the work and programme requirements, not company size."],
    ["Can I refer customers, providers or businesses?", "Potentially. Eligible referrals should be attributed through the canonical referral system, and only the programme's qualifying activity counts toward any benefit."],
    ["Can Partners build integrations?", "Yes, where relevant developer and integration capabilities are available. Partners should use canonical interfaces rather than creating parallel fulfilment systems."],
    ["How do partner earnings work?", "Any commission or commercial benefit depends on the live partner programme and qualifying events. A referral is not automatically a settled earning."],
    ["What tools and support do Partners receive?", "The available toolkit can include discovery, referral attribution, developer resources, partner communications and opportunities, depending on eligibility and programme maturity."],
    ["Can Partners receive opportunities from Kurukoo?", "Where the network has a relevant opportunity and your capability matches it, Kurukoo can surface that opportunity. It is not a guarantee of work."],
    ["Can Partners work with AI agents?", "Yes. AI agents can operate alongside human and business partners when their role, capabilities, permissions and escalation paths are defined."],
    ["What makes someone a trusted Partner?", "Accurate representation, useful outcomes, reliable activity, appropriate verification and clear evidence matter more than a marketing claim or badge alone."],
    ["Can I build a business around Kurukoo?", "That is the core partner story: combine a useful capability with Kurukoo's discovery, coordination and execution surfaces to create a sustainable service or integration."],
  ],
  Contributors: [
    ["What is a Kurukoo Contributor?", "A Contributor helps improve or operate useful parts of the Kurukoo network through defined tasks, knowledge, content, local activity or other approved contributions."],
    ["Do I need to be technical?", "No. Contributions can be practical, local, research-oriented, content-related or operational as well as technical where opportunities exist."],
    ["What kinds of tasks can Contributors do?", "Examples include adding useful local context, completing defined research or curation tasks, helping with onboarding, contributing knowledge or completing scoped network work."],
    ["How do I find contribution opportunities?", "Relevant opportunities can appear through Kurukoo's opportunity surfaces when available, including defined tasks and local opportunities."],
    ["Can I choose which tasks I take?", "Where an opportunity is offered as an open task, you can choose whether it is suitable before accepting it."],
    ["How is contribution verified?", "The applicable task or programme determines the evidence needed. Verification should be based on the contribution itself rather than an unverified claim."],
    ["Do Contributors earn Points?", "Kurukoo can use its Points system for qualifying contribution activity where the applicable programme supports it. Points are not automatically equivalent to cash."],
    ["Can Points become money or benefits?", "Only where a live programme explicitly provides a conversion or benefit. The OS should show the current rules rather than implying that every Point has a cash value."],
    ["How are Contributors recognised?", "Useful contribution can become part of your activity and reputation context, subject to verification and the relevant programme."],
    ["Can I move into another Kurukoo role?", "Yes. Contributors can participate in other roles such as Provider, Creator, Partner, Local Agent or Ambassador where eligible."],
    ["Are opportunities local or online?", "Both can exist. Each opportunity determines its location, evidence requirements and participation conditions."],
  ],
  Advertisers: [
    ["What can I advertise on Kurukoo?", "Eligible businesses, products, services, offers and other approved commercial propositions can be promoted through Kurukoo's advertising surfaces."],
    ["Can advertising respond to active intent?", "Kurukoo can use relevant context such as categories, topics and locations to make advertising more useful, subject to privacy, relevance and advertising rules."],
    ["What is the difference between an advertisement and a recommendation?", "An advertisement is paid placement. A fulfilment recommendation is based on discovery and execution logic. The two must not be deceptively blended."],
    ["Will sponsored content be labelled?", "Yes. Paid placement should be clearly disclosed so users can distinguish advertising from independent recommendations or fulfilment evidence."],
    ["Can I target locations, categories or topics?", "Where campaign controls support them, advertisers can target relevant locations, categories or topics. Exact controls depend on the live advertising product."],
    ["Can I promote a business, product or service?", "Yes, where the proposition is eligible and the selected advertising surface supports it. The advertised proposition must be genuine and accurately represented."],
    ["How are campaigns charged?", "Campaign pricing and billing depend on the live advertising product and selected placement. The frontend should only show confirmed pricing and billing state."],
    ["What reporting do I receive?", "The advertising workspace can expose activity and reporting that the canonical advertising system actually records. Example metrics remain clearly labelled."],
    ["How does Kurukoo protect people from irrelevant advertising?", "Advertising should remain relevant, clearly disclosed and governed by the applicable advertising and safety rules. Paid placement must not masquerade as trusted fulfilment proof."],
    ["Can advertisers become businesses, providers or partners too?", "Yes. Advertising is a participant capability, not an exclusive identity. An advertiser can also hold other eligible roles while keeping paid placement distinct."],
    ["Can I set a budget?", "Where the live campaign product supports budgets, the campaign workspace can capture the budget and show its current state before launch."],
  ],
  "Local Agents": [
    ["What is a Local Agent?", "A Local Agent provides trusted human reach where software alone cannot complete the connection, onboarding, coordination or practical local activity someone needs."],
    ["Why does Kurukoo need people on the ground?", "Real life still contains local knowledge, physical tasks, introductions and situations where an AI needs a trusted human connection to move something forward."],
    ["What can Local Agents actually do?", "Depending on authorisation, activities can include onboarding people or businesses, identifying providers and opportunities, supporting coordination and facilitating defined local activities."],
    ["Can I help people use Kurukoo?", "Yes. Helping someone understand and use Kurukoo can be part of an authorised local activity, especially where access, context or onboarding needs a human connection."],
    ["Can I identify local providers or demand?", "Yes, where the programme authorises the activity. Local Agents can help surface genuine local capabilities and needs without inventing availability or demand."],
    ["Do I need professional qualifications?", "Only activities requiring particular qualifications, verification or authorisation should be performed without the necessary eligibility."],
    ["How are opportunities assigned?", "Relevant local opportunities can be surfaced through Kurukoo's opportunity and agent systems. An opportunity is not a guarantee of work or earnings."],
    ["How are activities recorded?", "Supported activities should remain attached to the applicable task, evidence and outcome so the network can distinguish verified activity from an unconfirmed claim."],
    ["How do referrals and rewards work?", "Eligible referrals are attributed through the canonical referral system. A click, introduction or unqualified referral is not a settled reward."],
    ["What can I earn?", "Earnings or rewards depend on the authorised activity and live programme terms. Kurukoo should show what is payable only after the relevant conditions are met."],
    ["What happens if an activity cannot be completed?", "The agent should record the supported status or evidence and surface the next step rather than claiming completion when the real-world outcome is unresolved."],
    ["What safety rules apply?", "Local Agents must stay within permissions, avoid misrepresenting Kurukoo, protect people and information, and never promise an unconfirmed outcome, price, availability or reward."],
  ],
  Ambassadors: [
    ["What is a Kurukoo Ambassador?", "An Ambassador helps Kurukoo grow through trusted relationships and qualifying referrals rather than performing the local execution work of a Local Agent."],
    ["Who can become an Ambassador?", "People who can introduce Kurukoo accurately and responsibly can be eligible, subject to live programme rules and market availability."],
    ["Do I need to be a creator?", "No. Creators can also be Ambassadors, but the Ambassador role is about trusted adoption and referrals, not simply audience size."],
    ["Can I recommend Kurukoo to friends?", "Yes, where the referral programme permits it. The referral must be accurate and follow the current programme rules."],
    ["Can I recommend Kurukoo to businesses?", "Yes, where business referrals are part of the current programme. A business introduction only qualifies when the programme's stated conditions are satisfied."],
    ["Do I get a referral link or code?", "Where the live programme uses one, Kurukoo can provide an eligible link, code or attribution mechanism for your referrals."],
    ["What counts as a successful referral?", "The qualifying event is defined by the live Ambassador programme. An introduction or click alone is not automatically qualifying or payable."],
    ["How are referrals tracked?", "Eligible referrals are attributed through Kurukoo's canonical referral system using the applicable referral link, code or attribution mechanism."],
    ["When are rewards earned?", "Only after the applicable qualifying event and programme conditions are satisfied. Settlement timing depends on the live programme rules."],
    ["Are there referral milestones?", "Milestones can be used where the live Ambassador programme defines them. The page should reflect the current programme rather than promise a fixed reward."],
    ["Can businesses or creators also become Ambassadors?", "Yes, where eligible. Multiple participant roles can coexist, provided each activity follows its own rules and disclosure requirements."],
    ["What behaviour is prohibited?", "Spam, deceptive claims, unauthorised incentives, misleading advertising and attempts to manipulate attribution or programme rules are not acceptable."],
  ],
};

function roleKey(eyebrow: string | undefined, title: string) {
  const value = (eyebrow ?? title).replace(/^for\s+/i, "").trim().toLowerCase();
  if (value === "people / everyone") return "people";
  return value;
}

function RoleList({ title, items, icon: Icon }: { title: string; items: string[]; icon: typeof CheckCircle2 }) {
  return (
    <section className="rounded-[20px] border border-border bg-surface p-5 md:p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-tint text-brand-ink"><Icon className="size-4" /></span>
        <h2 className="font-serif text-[24px] tracking-[-0.035em]">{title}</h2>
      </div>
      <div className="mt-4 space-y-2.5">
        {items.map((item) => (
          <div key={item} className="flex gap-2.5 text-[12.5px] leading-5 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RoleLanding({
  eyebrow,
  title,
  intro,
  whatKurukooIs,
  participation,
  benefits,
  features,
  useCases,
  referral,
  offer,
  joinPrompt,
  primaryLabel = "Join Kurukoo",
  primaryTo = "/signup",
}: RoleLandingProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const key = roleKey(eyebrow, title);
  const story = roleStories[key] ?? { label: eyebrow?.replace(/^for\s+/i, "") ?? title, primary: title };
  const faqs = roleFaqs[story.label] ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-8">
      <header className="max-w-4xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">{story.label}</p>
        <h1 className="mt-2 max-w-4xl font-serif text-[40px] leading-[1.02] tracking-[-0.045em] md:text-[54px]">{story.primary}</h1>
        <p className="mt-4 max-w-3xl text-[14px] leading-7 text-muted-foreground">{intro}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={primaryTo as never} className={actionClass("primary")}>{primaryLabel}<ArrowRight className="ml-1 size-3.5" /></Link>
          <AskKurukoo prompt={joinPrompt}>Ask Kurukoo</AskKurukoo>
        </div>
      </header>

      <section className="rounded-[22px] border border-primary/20 bg-brand-tint/20 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/70 text-primary"><Sparkles className="size-4.5" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Why this role exists</p>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-foreground/85">{whatKurukooIs}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <RoleList title="What you can do" items={participation} icon={UsersRound} />
        <RoleList title="What you can get" items={benefits} icon={CheckCircle2} />
      </section>

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your Kurukoo workspace</p>
        <h2 className="mt-1 font-serif text-[27px] tracking-[-0.035em]">The surfaces that make the role useful</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <div key={item} className="rounded-[17px] border border-border bg-surface p-4">
              <CheckCircle2 className="size-4 text-primary" />
              <p className="mt-2 text-[12.5px] font-medium leading-5">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Demo examples</p>
          <h2 className="mt-1 font-serif text-[27px] tracking-[-0.035em]">What this could look like</h2>
          <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">These are clearly labelled example scenarios used to make the role concrete. They are not claims of live inventory, demand, availability, earnings or completed outcomes.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {useCases.map((item, index) => (
            <Panel key={item} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full border border-border bg-elevated/50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">Example {index + 1}</span>
                <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Demo</span>
              </div>
              <p className="mt-3 text-[12.5px] leading-5">{item}</p>
              <div className="mt-3"><AskKurukoo prompt={`${story.label}: ${item}`}>Try this in Chat</AskKurukoo></div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-border bg-elevated/35 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Trust, eligibility & expectations</p>
            <p className="mt-2 max-w-3xl text-[12.5px] leading-6 text-muted-foreground">Kurukoo should only present capabilities, opportunities, verification, pricing, availability or rewards that the underlying system can substantiate. Programme eligibility, authorisation and payout conditions are shown before they become commitments.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Panel className="p-5">
          <Gift className="size-5 text-primary" />
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Current programme & offers</p>
          <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{offer}</p>
        </Panel>
        <Panel className="p-5">
          <Link2 className="size-5 text-primary" />
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Referrals</p>
          <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{referral}</p>
        </Panel>
      </section>

      <FAQSection title={`${story.label} — frequently asked questions`} items={faqs} pagePath={pathname} />

      <section className="rounded-[22px] border border-primary/20 bg-brand-tint/15 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Start with Kurukoo</p>
            <h2 className="mt-1.5 font-serif text-[27px] tracking-[-0.035em]">Ready to take the next step?</h2>
            <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">Start the role, or ask Kurukoo a question with this role already in context.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={primaryTo as never} className={actionClass("primary")}>{primaryLabel}<ArrowRight className="ml-1 size-3.5" /></Link>
            <AskKurukoo prompt={joinPrompt}>Ask Kurukoo</AskKurukoo>
          </div>
        </div>
      </section>
    </div>
  );
}
