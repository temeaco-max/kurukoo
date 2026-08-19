export type Surface = "chat" | "discover" | "tasks" | "more";

export type RequestState = "Working" | "Waiting for you" | "Complete";

export type RequestItem = {
  id: string;
  title: string;
  detail: string;
  state: RequestState;
  action?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warning";
};

export const recentConversation = {
  title: "Find a reliable phone repairer",
  detail: "We paused this while you handled a reminder.",
};

export const requests: RequestItem[] = [
  {
    id: "request-phone-repair",
    title: "Find a reliable phone repairer",
    detail: "Matching evidence-backed options near your chosen area.",
    state: "Working",
    action: "Continue in Chat",
  },
  {
    id: "request-grocery-basket",
    title: "Compare a grocery basket",
    detail: "Waiting for you to confirm the preferred offer.",
    state: "Waiting for you",
    action: "Review offer",
  },
  {
    id: "request-safety-check-in",
    title: "Evening safety check-in",
    detail: "Your check-in is scheduled and privacy-protected.",
    state: "Complete",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "notification-provider-match",
    title: "A new match is ready",
    detail: "Kurukoo found a candidate that fits your phone-repair request.",
    tone: "neutral",
  },
  {
    id: "notification-reminder",
    title: "Reminder saved",
    detail: "I will bring this back into the conversation tomorrow.",
    tone: "success",
  },
];

export const discoveries = [
  {
    id: "discovery-repair",
    title: "Phone repair nearby",
    detail: "Discovery entity · source attributed · availability unconfirmed",
    tag: "Candidate",
  },
  {
    id: "discovery-market",
    title: "Fresh market route",
    detail: "Discovery entity · source attributed · claim status pending",
    tag: "Discover",
  },
  {
    id: "discovery-tailor",
    title: "Tailor and alterations",
    detail: "Opportunity surface · contributor invitation available",
    tag: "Opportunity",
  },
];

export const tasks = [
  { id: "task-match", title: "Find a reliable phone repairer", state: "Working", detail: "Agent is coordinating candidate options." },
  { id: "task-offer", title: "Compare grocery basket", state: "Waiting for you", detail: "Your choice is needed before anything proceeds." },
];
