import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Filter, UsersRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { skillFlows, type SkillEntry } from "@/lib/skill-catalog";
import { Badge, Panel, Tabs } from "@/components/kurukoo/ui";

type Coverage = "ai" | "hybrid" | "human";

const aiNative = new Set([
  "device_support",
  "warranty_tracker",
  "digital_executor",
  "digital_declutter",
  "inbox_zero",
  "train_check",
  "flight_alert",
  "word_of_day",
  "jamb_form_assistant",
  "language_tutor",
  "sketch_prompt",
  "creative_block",
  "sports_analyst",
  "pidgin_interpreter",
  "hausa_translator",
  "yoruba_transcriber",
  "igbo_tutor",
  "ijaw_voice",
  "mot_reminder",
  "micro_bookkeeper",
  "insurance_renewal",
  "energy_tariff",
  "retirement_coach",
  "contract_reviewer",
  "affidavit_assistant",
  "nin_passport_guidance",
  "bin_day",
  "council_tax",
  "parking_appeal",
  "genealogy",
  "borrowed_iou",
  "funeral_wishes",
  "bereavement_admin",
  "job_tracker",
  "tax_assistant",
  "side_hustle",
  "product_sourcing",
  "wholesale_rice_tracker",
  "cement_price_checker",
  "gift_finder",
  "right_to_roam",
  "urban_explorer",
  "museum_quiet",
  "vinyl_wantlist",
  "event_finder",
  "buy_ticket",
  "room_to_rent",
  "first_flat",
  "hotel_deals",
  "rental_tracker",
  "moving_house",
  "accessibility",
  "sleep_tracker",
  "energy_logger",
  "sad_lamp",
  "carer_break",
  "couch_to_5k",
  "walking_group",
  "running_beacon",
  "football_viewing_center",
  "thrift_collector_ajo",
  "group_savings_organiser",
  "micro_volunteer",
  "pride_events",
  "street_party",
  "lga_office_directory",
  "artisan_registry",
  "smart_tv_bridge",
  "ac_remote_bridge",
  "phone_repair",
  "phone_repairer",
  "religious_book_seller",
  "prayer_partner",
  "counselor",
  "home_tutor",
]);

const hybrid = new Set([
  "rider",
  "okada_rider",
  "keke_driver",
  "informal_taxi",
  "shuttle_driver",
  "school_run",
  "pet_taxi",
  "taxi_quick",
  "ride_request",
  "ev_charging",
  "suya_vendor",
  "orange_hawker",
  "street_food_cart",
  "caterer",
  "bakery",
  "zobo_seller",
  "kunu_seller",
  "food_nearby",
  "grocery_reminder",
  "order_food",
  "wifi_installer",
  "shoe_cobbler",
  "generator_repairer",
  "plumber",
  "electrician",
  "mechanic",
  "vulcaniser",
  "boiler_service",
  "repair",
  "mobile_barber",
  "home_hairdresser",
  "manicurist",
  "laundry_man",
  "house_cleaner",
  "medicine_delivery",
  "nursery_nurse",
  "doctor_appointment",
  "home_tutor",
  "event_mc",
  "dj",
  "live_band",
  "comedian",
  "verified_artist",
  "room_to_rent",
  "short_let_host",
  "house_agent",
  "poultry_farmer",
  "fish_seller",
  "fresh_veg_hawker",
  "allotment_sitter",
  "accounting_clerk",
  "legal_draftsman",
  "graphic_designer",
  "copywriter",
  "social_media_manager",
  "flyer_distributor",
  "queue_stander",
  "survey_taker",
  "find_worker",
  "dispatch_rider",
  "grocery_shopper",
  "bill_payment_runner",
  "document_courier",
  "recharge_card_seller",
  "buy_airtime",
  "data_reseller",
  "phone_accessory_hawker",
  "data_bundle",
  "haulage_driver",
  "cold_chain_operator",
  "boat_operator",
  "creek_guide",
  "city_tour_guide",
  "bead_maker",
  "tailor_fashion_designer",
  "photographer",
  "night_guard",
  "event_bouncer",
  "night_walk",
  "security_personnel",
  "fitness_trainer",
  "bar_triage",
  "lounge_promoter",
  "second_hand_phones",
  "clothes_bend_down",
  "car_boot",
  "charity_shop",
  "farm_shop",
  "buy_car",
  "akara_hot_seller",
  "puff_puff_hawker",
  "roasted_corn_vendor",
  "roadside_mechanic",
  "car_washer",
  "dog_breeder",
  "vet_assistant",
  "lost_pet",
  "pet_weight",
  "land_surveyor",
  "daycare_operator",
  "babysitter",
  "spa_masseuse",
  "makeup_artist",
  "fumigation_agent",
  "waste_collector",
  "ankara_seamstress",
  "suit_tailor",
  "inverter_installer",
  "solar_panel_technician",
  "canopy_rental",
  "public_address_system",
  "sachet_water_distributor",
  "tanker_water_supplier",
  "football_player",
  "basketball_player",
  "tennis_partner",
  "sports_coach",
  "football_club_founder",
  "match_organizer",
  "team_captain",
  "league_admin",
  "pitch_manager",
  "sports_event_host",
  "night_guard",
  "emergency",
  "ambulance_finder",
  "towing_service",
  "fire_service_contact",
  "security_patrol",
  "flood_line",
  "swep_alert",
]);

function coverage(skill: SkillEntry): Coverage {
  if (aiNative.has(skill.id)) return "ai";
  if (hybrid.has(skill.id)) return "hybrid";
  return "human";
}

const labels: Record<Coverage, { label: string; note: string }> = {
  ai: { label: "AI provider", note: "Kurukoo AI can handle the core job directly." },
  hybrid: {
    label: "AI + human",
    note: "AI can interpret, coordinate or assist; a human/provider completes the physical or consequential work.",
  },
  human: { label: "Human provider", note: "Keep this primarily in the human provider network." },
};

export function AIProviderCoverage() {
  const [filter, setFilter] = useState("AI provider");
  const options = ["AI provider", "AI + human", "Human provider", "All"];
  const counts = useMemo(
    () =>
      skillFlows.reduce(
        (acc, skill) => {
          acc[coverage(skill)] += 1;
          return acc;
        },
        { ai: 0, hybrid: 0, human: 0 } as Record<Coverage, number>,
      ),
    [],
  );
  const visible = useMemo(
    () =>
      skillFlows.filter((skill) => filter === "All" || labels[coverage(skill)].label === filter),
    [filter],
  );
  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-tint text-brand-ink">
              <Filter className="size-4" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold">AI provider coverage</h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Every capability is classified by the role an AI agent can safely play.
              </p>
            </div>
          </div>
          <Badge tone="quiet">{skillFlows.length} skills</Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-elevated/60 p-2.5">
            <p className="text-[16px] font-semibold">{counts.ai}</p>
            <p className="text-[9.5px] text-muted-foreground">AI-native</p>
          </div>
          <div className="rounded-xl bg-elevated/60 p-2.5">
            <p className="text-[16px] font-semibold">{counts.hybrid}</p>
            <p className="text-[9.5px] text-muted-foreground">Hybrid</p>
          </div>
          <div className="rounded-xl bg-elevated/60 p-2.5">
            <p className="text-[16px] font-semibold">{counts.human}</p>
            <p className="text-[9.5px] text-muted-foreground">Human-first</p>
          </div>
        </div>
      </div>
      <div className="px-3 pt-3">
        <Tabs items={options} value={filter} onChange={setFilter} />
      </div>
      <div className="grid max-h-[520px] gap-1 overflow-y-auto p-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((skill) => {
          const type = coverage(skill);
          return (
            <article key={skill.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-elevated">
                  {type === "human" ? (
                    <UsersRound className="size-3.5" />
                  ) : (
                    <Bot className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-medium">{skill.label}</p>
                  <Badge tone={type === "ai" ? "success" : "quiet"}>{labels[type].label}</Badge>
                </div>
              </div>
              <p className="mt-2 text-[9.5px] leading-relaxed text-muted-foreground">
                {labels[type].note}
              </p>
              {type === "ai" ? (
                <Link
                  to="/agents"
                  className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-medium hover:underline"
                >
                  <CheckCircle2 className="size-3" /> Available AI provider
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
