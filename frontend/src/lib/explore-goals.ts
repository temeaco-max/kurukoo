import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BriefcaseBusiness,
  Car,
  GraduationCap,
  HeartPulse,
  Home,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";

export type ExploreGoal = {
  id: string;
  label: string;
  prompt: string;
  /** Plain-language context for the goal, drawn from Kurukoo's canonical category definitions. */
  description?: string;
  icon: LucideIcon;
  capabilityIds: string[];
};

export type ExploreGoalGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  goals: ExploreGoal[];
};

const exploreGoalSeeds: ExploreGoalGroup[] = [
  {
    id: "everyday",
    label: "Everyday",
    icon: ShoppingBag,
    goals: [
      { id: "food", label: "Get food", prompt: "Help me get food", icon: ShoppingBag, capabilityIds: ["order_food", "food_nearby", "suya_vendor"] },
      { id: "groceries", label: "Get groceries", prompt: "Help me get groceries", icon: ShoppingBag, capabilityIds: ["grocery_shopper", "grocery_reminder"] },
      { id: "errands", label: "Get an errand done", prompt: "Help me get an errand done", icon: Sparkles, capabilityIds: ["find_worker", "bill_payment_runner", "document_courier"] },
      { id: "delivery", label: "Send or receive something", prompt: "Help me arrange a delivery", icon: MapPin, capabilityIds: ["dispatch_rider", "haulage_driver", "cold_chain_operator"] },
    ],
  },
  {
    id: "getting-around",
    label: "Getting around",
    icon: Car,
    goals: [
      { id: "ride", label: "Get a ride", prompt: "Help me get a ride", icon: Car, capabilityIds: ["ride_request", "taxi_quick", "okada_rider", "keke_driver"] },
      { id: "travel", label: "Plan travel", prompt: "Help me plan my travel", icon: MapPin, capabilityIds: ["train_check", "flight_alert", "hotel_deals", "city_tour_guide"] },
    ],
  },
  {
    id: "home",
    label: "Home & things",
    icon: Home,
    goals: [
      { id: "repair", label: "Fix something", prompt: "Help me get something repaired", icon: Home, capabilityIds: ["repair", "phone_repair", "generator_repairer", "plumber", "electrician"] },
      { id: "cleaning", label: "Get home help", prompt: "Help me find someone for my home", icon: Home, capabilityIds: ["house_cleaner", "laundry_man", "fumigation_agent", "waste_collector"] },
      { id: "solar", label: "Improve my energy", prompt: "Help me with solar or home energy", icon: Sparkles, capabilityIds: ["solar_panel_technician", "inverter_installer", "energy_tariff"] },
    ],
  },
  {
    id: "money-work",
    label: "Money & work",
    icon: Banknote,
    goals: [
      { id: "money-circle", label: "Start or manage a Money Circle", prompt: "Help me with my Money Circle", icon: Banknote, capabilityIds: ["thrift_collector_ajo", "group_savings_organiser"] },
      { id: "work", label: "Find work", prompt: "Help me find work or a gig", icon: BriefcaseBusiness, capabilityIds: ["side_hustle", "survey_taker", "find_worker"] },
      { id: "sell", label: "Sell something", prompt: "Help me sell something locally", icon: ShoppingBag, capabilityIds: ["second_hand_phones", "product_sourcing"] },
      { id: "business", label: "Grow my business", prompt: "Help me grow my business", icon: BriefcaseBusiness, capabilityIds: ["social_media_manager", "graphic_designer", "copywriter"] },
    ],
  },
  {
    id: "life",
    label: "Life",
    icon: HeartPulse,
    goals: [
      { id: "health", label: "Get health or care help", prompt: "Help me find health or care support", icon: HeartPulse, capabilityIds: ["doctor_appointment", "nursery_nurse", "carer_break", "medicine_delivery"] },
      { id: "education", label: "Learn or study", prompt: "Help me learn or study", icon: GraduationCap, capabilityIds: ["home_tutor", "language_tutor", "jamb_form_assistant", "word_of_day"] },
      { id: "spiritual", label: "Pray or reflect", prompt: "Help me pray or reflect", icon: Sparkles, capabilityIds: ["prayer_partner", "religious_book_seller"] },
    ],
  },
  {
    id: "community",
    label: "People & community",
    icon: Users,
    goals: [
      { id: "events", label: "Find something happening", prompt: "Help me find an event", icon: Users, capabilityIds: ["event_finder", "buy_ticket", "live_band"] },
      { id: "sports", label: "Play or follow sport", prompt: "Help me find sport activities", icon: Users, capabilityIds: ["football_player", "basketball_player", "tennis_partner", "sports_coach"] },
      { id: "connect", label: "Find people who can help", prompt: "Help me find someone who can help", icon: MessageCircle, capabilityIds: ["find_worker", "skill_swap", "micro_volunteer"] },
    ],
  },
  {
    id: "safety",
    label: "Safety & urgent help",
    icon: ShieldCheck,
    goals: [
      { id: "emergency", label: "Get urgent help", prompt: "I need urgent help", icon: ShieldCheck, capabilityIds: ["emergency", "ambulance_finder", "fire_service_contact"] },
      { id: "security", label: "Get security help", prompt: "Help me with security", icon: ShieldCheck, capabilityIds: ["security_patrol", "security_personnel", "night_guard"] },
    ],
  },
];

/**
 * Category context carried over from Kurukoo's canonical category definitions. These lines
 * describe what the goal usually involves; they never state availability, price or a provider.
 */
const goalDescriptions: Record<string, string> = {
  food: "Local dishes, fresh meals, catering and food delivery. Availability and pricing are confirmed in the request flow.",
  errands: "Send packages, run grocery errands, queue at banks or pick up dry cleaning.",
  delivery: "Dispatch riders, haulage, truck rental and freight coordination.",
  ride: "Okada, keke or city taxi travel. Availability and fare are confirmed in the request flow.",
  travel: "Trip planning, accommodation and local excursions. Nothing is shown as booked until it is confirmed.",
  repair: "Plumbing, electrical work, generators, appliances and related technicians.",
  cleaning: "Artisans, cleaners and labourers. Provider details are shown only after validation.",
  "money-circle": "Peer-to-peer savings circles, ajo, contribution clubs and buying pools.",
  work: "Micro-tasks, short-term assignments and work requests. No earnings or placement outcome is guaranteed.",
  sell: "A classified listing or local sale request. Items and sellers are not shown as available until confirmed.",
  business: "Writers, designers, video editors, translators, marketers, web development, social media management and tech support.",
  health: "Non-emergency needs involving pharmacies, nursing services, prescription delivery or consultations.",
  education: "Private home tutors for mathematics, science, languages and exam prep, plus school placement advice and professional training.",
  spiritual: "Spiritual counselling, prayer requests, home blessings and religious guidance.",
  events: "Event planners, MCs, DJ services, rentals and party coordination.",
  sports: "Personal trainers, fitness bootcamps, aerobic classes and sports coaching.",
  connect: "Neighbourhood associations, charity drives, volunteer groups and town hall forums.",
  emergency: "Urgent local help routed to the appropriate service. Kurukoo is not an emergency-response service.",
  security: "Security-related providers where the applicable requirements can be confirmed.",
};

function withGoalDescription(goal: ExploreGoal): ExploreGoal {
  const description = goalDescriptions[goal.id];
  return description ? { ...goal, description } : goal;
}

export const exploreGoalGroups: ExploreGoalGroup[] = exploreGoalSeeds.map((group) => ({ ...group, goals: group.goals.map(withGoalDescription) }));

export const exploreGoalById = Object.fromEntries(
  exploreGoalGroups.flatMap((group) => group.goals.map((goal) => [goal.id, goal])),
) as Record<string, ExploreGoal>;
