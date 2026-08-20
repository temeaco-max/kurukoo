export type DiscoverItemType = "discovery" | "topic" | "capability" | "promotion";
export type DiscoverAction = "watch" | "follow" | "save" | "open_chat" | "act";

export type DiscoverItem = {
  id: string;
  type: DiscoverItemType;
  section?: "for_you" | "nearby" | "today" | "topics" | "opportunities" | "explore";
  title: string;
  detail: string;
  category?: string;
  entityType?: string;
  source?: string;
  freshnessAt?: string;
  expiresAt?: string;
  distanceMetres?: number;
  verified?: boolean;
  available?: boolean;
  lifecycle?: string;
  actions?: DiscoverAction[];
  chatAction?: { id?: string; prompt?: string };
  score?: number;
  sponsored?: boolean;
  disclosure?: string;
  destination?: string;
  ctaText?: string;
};

export type DiscoverHome = {
  generatedAt: string;
  sections: Record<string, DiscoverItem[]>;
  sparse: boolean;
  density: "rich" | "sparse" | "empty";
  explanation: string;
  watchedItemIds: string[];
};
