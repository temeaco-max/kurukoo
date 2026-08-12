# Kurukoo Phase 6: Frontend Information Architecture

| Route | Purpose | Access |
| :--- | :--- | :--- |
| `/` | Landing page & primary entry | Public |
| `/discover` | Nearby provider radar | Public |
| `/explore` | Category-based discovery | Public |
| `/explore/:slug` | Specific category landing | Public |
| `/p/:slug` | Provider profile | Public |
| `/how-it-works` | Product explanation | Public |
| `/network` | Ecosystem & participant overview | Public |
| `/channels` | Truthful availability status | Public |
| `/resources` | Help, articles, & FAQs | Public |
| `/pricing` | Points & subscription info | Public |
| `/login` | Standalone OTP entry | Public |
| `/chat` | Primary fulfillment interface | Mixed (Guest/Auth) |
| `/web` | Request Hub management | Authenticated |
| `/settings` | Account & privacy management | Authenticated |
| `/admin/*` | Operational tools | Admin |
