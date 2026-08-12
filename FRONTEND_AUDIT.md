# Kurukoo Frontend Audit & Convergence Inventory

## Existing Page Inventory

| Page | Path | Why does it exist? | Who is it for? | User Problem Solved | Disposition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Home** | `/` | Core product landing. | New/returning visitors. | Understand Kurukoo & start chatting. | **Rewritten**: Refine language, consolidate sections. |
| **Explore** | `/explore` | Category discovery. | Users looking for ideas. | "What can I ask Kurukoo?". | **Rewritten**: Focus on conversational entry. |
| **Category** | `/explore/:slug` | Specific capability details. | Intent-specific users. | Detailed view of a specific service area. | **Rewritten**: Update copy, seed chat. |
| **Discover** | `/discover` | Nearby activity map. | Local users. | See what's happening around me. | **Retained**: Improve visual consistency. |
| **Dashboard** | `/web` | User activity hub. | Authenticated users. | Manage conversations/requests. | **Rewritten**: Rethink as Request Hub. |
| **Chat** | `/chat` | Primary interface. | Everyone. | Getting things done via conversation. | **Retained**: Hardening & visual sync. |
| **Resources** | `/resources` | Knowledge & Guides. | Everyone. | Learn how to use/benefit from Kurukoo. | **Rewritten**: Educational support layer. |
| **About** | `/about` | Mission & Vision. | Potential partners/users. | Understand the network orchestration model. | **Rewritten**: Vision-first copy. |
| **Login** | `/login` | Identity entry. | Unauthenticated users. | Seamless auth transition. | **Rewritten**: (Done) hard-coded for continuity. |
| **Pricing** | `/pricing` | Cost explanation. | Users concerned about fees. | Understanding Points & Fulfillment costs. | **Renamed/Rewritten**: "Points & Fulfillment". |
| **Help** | `/help` | Support/FAQ. | Users with issues. | Get quick answers to common problems. | **Merged**: Merge into Resources. |
| **Partners** | `/partners` | B2B/Partner entry. | Potential partners. | How to join the Kurukoo network. | **Retained**: Align with Network model. |
| **Advertise** | `/advertise` | Ad placement info. | Potential advertisers. | Monetization boundaries & opportunities. | **Retained**: Define ad boundaries. |
| **For You** | `/for-you` | Persona selection. | New users. | Tailoring the experience. | **Removed**: Integrate into onboarding/chat. |
| **Blog** | `/blog` | News/Updates. | General audience. | Stay updated on Kurukoo. | **Merged**: Integrate into Resources. |
| **Careers** | `/careers` | Job listings. | Job seekers. | Joining the team. | **Retained**. |
| **Legal** | `/legal` | Policies. | Everyone. | Privacy, Terms, Safety. | **Retained**. |

## Navigation Redesign (Hypothesis)

**Header:**
- Kurukoo (Logo)
- Discover (Map/Nearby)
- How it works (Process)
- Network (Participants)
- Resources (Knowledge)
- **Start chatting** (Primary CTA)
- Account/Login (Identity)

**Footer:**
- Core: Discover, How it works, Network, Resources, About
- Support: Help, Contact, Trust & Safety, Points
- Legal: Privacy, Terms
- CTA: Start chatting

## Terminology Audit

| Old Term | New Term | Context |
| :--- | :--- | :--- |
| Marketplace / Directory | Orchestration Network | Core product description. |
| Bot / Chatbot | Conversational Utility | Interaction model. |
| Economic Request | Request / Conversation | User-facing language. |
| Xentrix (Legacy) | Kurukoo | Brand name. |
| USSD-first / WhatsApp-first | Channel-Agnostic | Access model. |

## Icon System Audit

- **Current State**: Mixed emojis, inconsistent SVGs, some legacy icons.
- **Target**: Single Kurukoo icon language (e.g., Lucide-style or custom consistent SVG set).
- **Semantic Mapping**:
    - Conversation -> `chat-bubble`
    - Fulfillment -> `check-circle`
    - Provider -> `user` / `building`
    - Agent -> `cpu` / `bot`
    - Delivery -> `truck` / `package`
    - Points -> `database` / `coins`
