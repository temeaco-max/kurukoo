# Kurukoo OS — Visual Architecture

## Reference

The Kurukoo OS visual reference is the supplied Personal Workspace composition: compact top command bar, persistent left navigation, information-dense card grid, contextual right rail, quiet cream canvas, white elevated cards, compact iconography, and clear action hierarchy.

The reference is a **composition rule**, not a literal static screen. Kurukoo keeps different product jobs distinct while sharing the same visual grammar.

## Shells

### Authenticated OS

Used by `/app/*` and authenticated workspace surfaces.

- top command bar / global Ask entry;
- Orbit navigation;
- dense card/grid composition;
- optional right Pulse/context rail;
- persistent mobile bottom navigation;
- compact status chips and action rows.

### Chat

Chat remains a dedicated conversation workspace, not a dashboard clone.

It inherits the same:

- typography;
- cream/surface palette;
- cards;
- icon buttons;
- accent actions;
- border/radius/shadow language.

Chat owns conversation flow, not the dashboard information architecture.

### Discover

Discover is the visual opportunity/composition surface:

- For You;
- Nearby;
- Today / Daily Picks;
- Topics;
- Opportunities;
- Products;
- Explore Kurukoo.

Its map is a presentation layer, not another source of truth.

### Public/marketing

Marketing, Help Centre, Resources, Blog, About, Careers, Pricing, Legal, Channels and Network share the same visual tokens but use a calmer editorial composition.

Public pages should always expose the most relevant next action into the OS:

- Start chatting;
- Explore;
- Become a provider;
- Become an agent;
- Promote a business;
- Connect a channel;
- Read Help/Resources.

### Admin

Admin keeps its operator-specific information density and security model but uses the same visual primitives: cards, status chips, tables, command/actions, and restrained accent use.

## Visual primitives

- cream/off-white application canvas;
- white cards with subtle borders;
- 14–22px corner radii depending on hierarchy;
- very soft shadows;
- compact icon badges;
- Space Grotesk for headings and Inter for body/interface copy;
- terracotta/coral primary action;
- green success/connected state;
- blue informational state;
- amber pending state;
- red/error state;
- no ornamental decoration that competes with the task.

## Card composition rules

Every meaningful card should have:

1. optional small uppercase label;
2. icon or status marker;
3. clear title;
4. short useful description/state;
5. one primary next action or an explicit set of bounded actions.

Cards should be composable in 2-column/3-column desktop grids and collapse to a single column without losing hierarchy.

## Product weaving

The visual layer must not invent product objects. Cards render canonical sources:

- Topics;
- Providers;
- Products/catalogue;
- Promotions/ads;
- Opportunities;
- Economic Requests;
- Tasks/reminders;
- Agents;
- Points;
- Channels;
- Safety state;
- Journey projection;
- Help/resources.

Every new visible feature must identify its canonical backend owner and use that owner as the source of truth.

## Chat distinction

Guest Chat and authenticated Chat may have different access/identity affordances, but they share the same visual language. Authentication should change capability and continuity—not make the product look like an unrelated application.

## OS / Chat distinction

The OS dashboard answers:

> What is useful to know, continue, manage or discover right now?

Chat answers:

> What do you want Kurukoo to understand or do?

Discover answers:

> What is useful, available, happening or worth following?

These are complementary surfaces, not competing products.

## Regression rule

A visual refactor is incomplete if it:

- removes an existing feature entry point;
- creates a second source of truth;
- creates a second navigation owner;
- breaks mobile parity;
- removes provider/channel/agent/commercial visibility;
- hides Help, Resources, Legal, Careers, About or public trust surfaces;
- makes Chat inaccessible from OS surfaces;
- makes Discover inaccessible from Chat/OS;
- uses fake data where canonical data is unavailable.
