# Kurukoo FastText held-out evaluation corpus (v1.0)

**Provenance:** This file is the canonical held-out evaluation set for FastText intent
routing. It was authored separately from any training source (`intent_training_data.txt`,
`intent_training_behaviour_additions.txt`, `intent_training_skill_hints.txt`) and must
**never** be appended to a training corpus. It is consumed read-only by
`scripts/evaluate-fasttext-heldout.ts`.

**Split rule:** All production-classifier evaluation in this task uses the cases in this
file verbatim. No case in this file appears in the committed training files. Train/test
separation is guaranteed by provenance, not by hashing, so the same set can be reused
deterministically for baseline/manual/manual/autotune/quantization comparisons.

**Coverage (category-balanced where sample volume allows, plus hard negatives):**
- Conversational acts: greeting, thanks, how_to, confirmation.
- Repair skills: phone, laptop, TV, earbuds, speaker, smartwatch, appliance, bicycle
  (device-repair subtypes and reversed word order "repair my airpods").
- Ride/delivery: okada_rider, keke_driver, ride_request, local_courier, school_run.
- Food: order_food (Nigerian dishes: pounded yam, jollof rice, suya, moi moi).
- Services: find_worker (plumber/electrician/carpenter), locksmith, key_cutter,
  gas_refill, parcel_pickup, window_cleaner, laundry_pickup, market_shopper,
  borehole_water, generator_fuel_delivery, boiler_repairer, rubbish_removal, hotel_deals,
  mot_booking, pos_agent, sports_matchmaking, prayer, emergency, safety, bin_day,
  advertising, general_question.
- Hard negatives: 4 nonsense/off-topic cases (`__label__off_topic`) — a correctly
  designed classifier should abstain or misclassify harmlessly rather than confidently
  emit a real skill.
- Nigerian English / Pidgin / UK phrasing variants included in several acts above.

**Guarantee:** each line is `__label__<label> <utterance>`; labels are drawn from the live
catalogue. `off_topic` is intentionally not a catalogue skill.
