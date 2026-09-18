// DEMO CONTENT ONLY.
// Every value below is illustrative content used to establish UI contracts.
// Nothing here reflects real providers, balances, campaigns, followers or connections.
// Replace with real API reads when the Kurukoo backend exists — do not grow this file
// into business logic.

export type EntityKind = "provider" | "business" | "creator" | "person" | "partner" | "contributor";

export type Entity = {
  id: string;
  name: string;
  kind: EntityKind;
  tagline: string;
  location?: string;
  topics: string[];
  verified?: boolean;
  rating?: number;
  followers?: number;
  services?: string[];
};

export const entities: Entity[] = [
  {
    id: "north-lane-plumbing",
    name: "North Lane Plumbing",
    kind: "provider",
    tagline: "Emergency and scheduled plumbing across the north side.",
    location: "Manchester",
    topics: ["home", "repairs"],
    verified: true,
    rating: 4.8,
    followers: 312,
    services: ["Leak repair", "Boiler service", "Bathroom fitting"],
  },
  {
    id: "harper-dental",
    name: "Harper Dental",
    kind: "business",
    tagline: "Family dentistry with same-week appointments.",
    location: "Manchester",
    topics: ["health"],
    verified: true,
    rating: 4.6,
    followers: 1240,
    services: ["Check-up", "Hygienist", "Emergency slot"],
  },
  {
    id: "pixel-repair-co",
    name: "Pixel Repair Co",
    kind: "business",
    tagline: "Phone, tablet and laptop repair while you wait.",
    location: "Leeds",
    topics: ["devices", "repairs"],
    rating: 4.4,
    followers: 860,
    services: ["Screen replacement", "Battery", "Data recovery"],
  },
  {
    id: "mara-okafor",
    name: "Mara Okafor",
    kind: "creator",
    tagline: "Practical home maintenance, explained calmly.",
    topics: ["home", "how-to"],
    followers: 48200,
  },
  {
    id: "sam-idris",
    name: "Sam Idris",
    kind: "creator",
    tagline: "Devices, repairs and what's actually worth fixing.",
    topics: ["devices"],
    followers: 12800,
  },
  {
    id: "j-whitfield",
    name: "Jo Whitfield",
    kind: "person",
    tagline: "Neighbour · shares a plumber recommendation",
    topics: ["home"],
  },
  {
    id: "northwind-energy",
    name: "Northwind Energy",
    kind: "partner",
    tagline: "Home energy assessments across the UK.",
    topics: ["home", "energy"],
    verified: true,
  },
  {
    id: "ade-fisher",
    name: "Ade Fisher",
    kind: "contributor",
    tagline: "Accessibility reviews and voice interaction testing.",
    topics: ["accessibility"],
  },
  {
    id: "lena-cruz",
    name: "Lena Cruz",
    kind: "contributor",
    tagline: "Community moderation and topic curation.",
    topics: ["community"],
  },
];

export const entityById = (id: string) => entities.find((e) => e.id === id);

export type Topic = {
  slug: string;
  name: string;
  blurb: string;
  followers: number;
  posts: { id: string; author: string; text: string; when: string }[];
};

export const topics: Topic[] = [
  {
    slug: "home-repairs",
    name: "Home repairs",
    blurb: "Fixing things around the house, and who to trust with them.",
    followers: 5210,
    posts: [
      {
        id: "p1",
        author: "Jo Whitfield",
        text: "Radiator bleeding took ten minutes once someone showed me the order to do it in.",
        when: "2h",
      },
      {
        id: "p2",
        author: "North Lane Plumbing",
        text: "If your boiler pressure drops weekly, it's usually a small leak, not the boiler.",
        when: "1d",
      },
    ],
  },
  {
    slug: "devices",
    name: "Devices",
    blurb: "Phones, laptops and whether a repair beats a replacement.",
    followers: 3180,
    posts: [
      {
        id: "p3",
        author: "Sam Idris",
        text: "Battery swaps are still the cheapest way to add two years to a phone.",
        when: "5h",
      },
    ],
  },
  {
    slug: "health-appointments",
    name: "Health appointments",
    blurb: "Getting seen sooner, and what to ask for.",
    followers: 2740,
    posts: [
      {
        id: "p4",
        author: "Harper Dental",
        text: "Cancellation lists move faster than people expect — always ask to be added.",
        when: "3d",
      },
    ],
  },
];

export const topicBySlug = (slug: string) => topics.find((t) => t.slug === slug);

export type Video = {
  id: string;
  title: string;
  creatorId: string;
  duration: string;
  views: string;
  topic: string;
};

export const videos: Video[] = [
  {
    id: "stop-a-leak",
    title: "Stop a leaking tap in under ten minutes",
    creatorId: "mara-okafor",
    duration: "8:12",
    views: "214K",
    topic: "home-repairs",
  },
  {
    id: "boiler-basics",
    title: "Boiler basics: what a service actually covers",
    creatorId: "mara-okafor",
    duration: "12:40",
    views: "96K",
    topic: "home-repairs",
  },
  {
    id: "repair-or-replace",
    title: "Repair or replace? A simple rule for phones",
    creatorId: "sam-idris",
    duration: "6:05",
    views: "58K",
    topic: "devices",
  },
];

export const videoById = (id: string) => videos.find((v) => v.id === id);

export type Thread = {
  id: string;
  withId: string;
  subject: string;
  when: string;
  unread: number;
  messages: { id: string; from: "you" | "them"; text: string; when: string }[];
};

export const threads: Thread[] = [
  {
    id: "t-plumber",
    withId: "north-lane-plumbing",
    subject: "Leaking kitchen tap",
    when: "12m",
    unread: 1,
    messages: [
      {
        id: "m1",
        from: "you",
        text: "Kurukoo shared the details — can you look this week?",
        when: "1h",
      },
      { id: "m2", from: "them", text: "Thursday morning works. Is 9am alright?", when: "12m" },
    ],
  },
  {
    id: "t-dental",
    withId: "harper-dental",
    subject: "Check-up appointment",
    when: "2d",
    unread: 0,
    messages: [
      {
        id: "m3",
        from: "them",
        text: "We have a cancellation slot on Friday at 3:20pm.",
        when: "2d",
      },
    ],
  },
];

export const threadById = (id: string) => threads.find((t) => t.id === id);

export type Connection = {
  id: string;
  name: string;
  category: "storage" | "messaging" | "email" | "calendar";
  description: string;
  state: "connected" | "available" | "coming_soon";
  permissions: string;
};

export const connections: Connection[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    category: "storage",
    description: "Store files Kurukoo creates or you upload.",
    state: "available",
    permissions: "Would read and write only files Kurukoo creates.",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    category: "storage",
    description: "Alternative storage destination for your files.",
    state: "coming_soon",
    permissions: "Not available yet.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "storage",
    description: "Alternative storage destination for your files.",
    state: "coming_soon",
    permissions: "Not available yet.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "messaging",
    description: "Let Kurukoo reach people where they already reply.",
    state: "available",
    permissions: "Would send messages you approve first.",
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "messaging",
    description: "Message and receive updates through Telegram.",
    state: "available",
    permissions: "Would send messages you approve first.",
  },
  {
    id: "email",
    name: "Email",
    category: "email",
    description: "Send and receive on your behalf with approval.",
    state: "available",
    permissions: "Would send only messages you approve.",
  },
  {
    id: "calendar",
    name: "Calendar",
    category: "calendar",
    description: "Check availability before booking anything.",
    state: "available",
    permissions: "Would read free/busy times only.",
  },
];

export type Artifact = {
  id: string;
  name: string;
  type: "document" | "image" | "video" | "generated";
  size: string;
  when: string;
  storage: string;
  workTitle?: string;
};

export const artifacts: Artifact[] = [
  {
    id: "a1",
    name: "Plumbing quote comparison.pdf",
    type: "generated",
    size: "148 KB",
    when: "Yesterday",
    storage: "Kurukoo (temporary)",
    workTitle: "Find me a plumber",
  },
  {
    id: "a2",
    name: "Under-sink photo.jpg",
    type: "image",
    size: "2.1 MB",
    when: "Yesterday",
    storage: "Kurukoo (temporary)",
    workTitle: "Find me a plumber",
  },
];

export type Transaction = {
  id: string;
  label: string;
  when: string;
  kind: "points" | "money";
  amount: string;
  direction: "in" | "out";
};

export const transactions: Transaction[] = [
  {
    id: "x1",
    label: "Request coordination",
    when: "Yesterday",
    kind: "points",
    amount: "20 pts",
    direction: "out",
  },
  {
    id: "x2",
    label: "Monthly points allowance",
    when: "1 Sep",
    kind: "points",
    amount: "500 pts",
    direction: "in",
  },
  {
    id: "x3",
    label: "Kurukoo Plus subscription",
    when: "1 Sep",
    kind: "money",
    amount: "£8.00",
    direction: "out",
  },
];

export type Plan = {
  id: string;
  name: string;
  price: string;
  audience: "user" | "provider" | "business" | "creator";
  benefits: string[];
  current?: boolean;
};

export const plans: Plan[] = [
  {
    id: "free",
    name: "Kurukoo",
    price: "Free",
    audience: "user",
    benefits: ["Conversation and work tracking", "Basic discovery", "100 points a month"],
  },
  {
    id: "plus",
    name: "Kurukoo Plus",
    price: "£8 / month",
    audience: "user",
    benefits: ["500 points a month", "Priority coordination", "Voice sessions"],
    current: true,
  },
  {
    id: "provider",
    name: "Provider",
    price: "£19 / month",
    audience: "provider",
    benefits: ["Incoming requests", "Customer messaging", "Reputation profile"],
  },
  {
    id: "business",
    name: "Business",
    price: "£49 / month",
    audience: "business",
    benefits: ["Team seats", "Advertising tools", "Analytics"],
  },
  {
    id: "creator",
    name: "Creator",
    price: "Revenue share",
    audience: "creator",
    benefits: ["Publishing tools", "Subscriber model", "Topic placement"],
  },
];

export type Campaign = {
  id: string;
  name: string;
  status: "active" | "paused" | "draft";
  budget: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversions: string;
  placement: string;
};

export const campaigns: Campaign[] = [
  {
    id: "c1",
    name: "Same-week dental slots",
    status: "active",
    budget: "£15 / day",
    spend: "£42.10",
    impressions: "18,204",
    clicks: "612",
    conversions: "37",
    placement: "Explore · Daily Picks",
  },
  {
    id: "c2",
    name: "Boiler service autumn",
    status: "paused",
    budget: "£10 / day",
    spend: "£128.00",
    impressions: "63,880",
    clicks: "1,904",
    conversions: "88",
    placement: "Topic feeds",
  },
];

export type Agent = {
  id: string;
  name: string;
  purpose: string;
  status: "available" | "busy" | "handoff";
  verified?: boolean;
};

export const agents: Agent[] = [
  {
    id: "coordinator",
    name: "Getting things sorted",
    purpose: "Turns what you say into a clear next step and keeps the request moving.",
    status: "available",
    verified: true,
  },
  {
    id: "outreach",
    name: "Making contact",
    purpose: "Reaches the right people and keeps replies moving when you ask.",
    status: "busy",
    verified: true,
  },
  {
    id: "scheduler",
    name: "Finding a time",
    purpose: "Finds times that fit your calendar before anything is arranged.",
    status: "available",
  },
  {
    id: "researcher",
    name: "Comparing options",
    purpose: "Brings together useful choices, prices and reviews so you can decide.",
    status: "available",
  },
  {
    id: "handoff",
    name: "Human support",
    purpose: "Brings in a person when a situation needs human judgement.",
    status: "handoff",
  },
];

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  body: string[];
};

export const articles: Article[] = [
  {
    slug: "what-kurukoo-is-for",
    title: "What Kurukoo is for",
    excerpt:
      "Most tools give you somewhere to type. Kurukoo gives you somewhere to hand things over.",
    date: "12 August 2026",
    body: [
      "Most software asks you to do the work in a nicer interface. Kurukoo starts from a different place: you say what you need, and the work happens around you.",
      "That means conversation is the front door, and every other surface — discovery, activity, contacts, files — exists to support what was said.",
    ],
  },
  {
    slug: "designing-for-handover",
    title: "Designing for handover",
    excerpt: "Trust is built in the small moments where an assistant checks before acting.",
    date: "28 July 2026",
    body: [
      "Handing a task to someone else only works when you can see what they are doing and stop them before something is committed.",
      "Kurukoo shows the steps, asks before anything is booked or paid for, and keeps the trail readable afterwards.",
    ],
  },
  {
    slug: "welcome-to-kurukoo",
    title: "Welcome to Kurukoo: wake up, get going",
    excerpt:
      "Tell Kurukoo what you need and let it work out the next step. One service, many ways to help.",
    date: "27 August 2026",
    body: [
      "Kurukoo is a service that helps people get things done. You tell Kurukoo what you need, want, notice or are worried about. Kurukoo works out the situation, decides what it can safely do, takes appropriate action, brings in people or services when that is necessary, keeps you informed and remembers what matters.",
      "You do not need to know which category your problem belongs to. Say it in your own words — “I'm running late and need to get to the airport”, “my laptop is slow, check it”, “find somewhere good to eat tonight”, “remind me about this tomorrow”, “keep an eye on this”. Kurukoo works out what information and which next step are useful.",
      "When the available device, service or connected resource exposes what Kurukoo needs, it can inspect, explain, diagnose, organise, monitor or take an appropriate authorised action. It should not send you to a person unnecessarily. If something needs physical access, specialist expertise or another participant, Kurukoo can help find and coordinate that help and carry the useful context forward.",
      "Kurukoo can work across everyday assistance, services, products, places, providers, connected devices, memory, tasks, reminders, discovery, agents and physical fulfilment. The experience stays one service even when different tools, people or external systems are involved.",
      "Kurukoo should tell you what it knows, what it needs from you, what it is doing and what happened. Important actions can require your permission. If something cannot be established or completed, Kurukoo should say so rather than pretending.",
      "When you are away, supported notifications and channels can bring important updates to you. When you return, the same work continues from its existing context instead of starting over.",
      "Capabilities are not a fixed list of categories. As new ways of helping become possible they should become part of the same service rather than turning into disconnected products. The goal is simple: tell Kurukoo what you need, and let Kurukoo help you get it done.",
    ],
  },
];

export const articleBySlug = (slug: string) => articles.find((a) => a.slug === slug);
