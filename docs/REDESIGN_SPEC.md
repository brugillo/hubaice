# HUBAICE Web Redesign Spec
*Based on Sergio's UI mockup — 28 feb 2026*

## Brand System
- **Primary color:** #5FE0CF (mint/turquoise)
- **Score color:** #99FF00 (acid green) — in-product UI only
- **Background dark:** #0A0F14 (near-black)
- **Card dark:** #121A22
- **Border:** #1A2B3C
- **Text primary:** #FFFFFF
- **Text muted:** #8A9BB0
- **Light mode:** Secondary, white backgrounds with dark text
- **Font:** Geometric sans (Inter or similar)
- **Logo SVG:** /public/brand/HUBAICE_logo.svg (#5FE0CF icon + white text)
- **Favicon:** /public/brand/AICE_logo_transparent.png
- **Icon PNGs:** /public/brand/HUBAICE_logo_4000px.png

## Pages to Build (6 total)

### 1. Landing/Home (`/`)
**Desktop (1440px) + Mobile (390px)**

- **Header:** HUBAICE logo (SVG) | Home, Project, Score | Log In, Sign up (button)
- **Hero section:**
  - Left: "The confident way to collaborate with AI." + subtitle about scoring + CTAs (Try Demo green, Join outline, See Leaderboard text)
  - Right: AICE Score gauge (semicircle 0-100 with needle), Maturity level indicator (bar from start to Expert)
- **Stats bar:** 120K+ Users | 4M+ Collaborations | 800+ Verified Leaders (placeholder numbers)
- **Footer:** "Privacy-first scoring. Your interactions are analyzed for patterns, never stored or sold."
- **Mobile:** Stacked layout, gauge below hero text

### 2. Onboarding (`/onboard`)
**Mobile-first (390px), also works desktop**

- **Step 1:** "Pick your goal" — icon grid (Work, Study, Creativity, Parenting, Health)
- **Step 2:** "Pick your AI assistant" — avatar grid (Assistant A-E, Other ...)
- **Advanced section (expandable):**
  - Show Model/Runtime Details
  - Model/Version fields
  - Performance metrics
  - Compatible version info
  - Privacy toggle
- **"How we score" section:**
  - Domains: clarity, discipline, coordination, safety (map to our TECH, OPS, ORCH, COMMS/JUDGMENT)
  - Description of scoring method

### 3. Feed / Experiences (`/feed`)
**Desktop + Mobile**

- **Desktop:** Table view
  - Tabs: Agents | Users
  - Search bar + Category dropdown + Assistant type dropdown
  - Columns: Rank, Name/Agent Name, (badges: Verified/Integrity), Score
  - Rows with score values and link arrows
- **Mobile:** Card-based social feed
  - Top: AICE Score gauge + maturity
  - Daily Challenge card (with streak badge)
  - Feed cards:
    - Abstract avatar + username
    - "Outcome: [description of interaction]"
    - Confidence score delta (+3.2 Δ Confidence Score)
    - Domain tags (Development, Productivity, etc.)
    - Reactions: Helpful ♥, Interesting 🔢 counts
    - "View details ▾"

### 4. Leaderboard (`/leaderboard`)
**Desktop (1440px)**

- Light mode variant shown:
  - Table: Rank, Agent Name, Score (0-100 gauge per row)
  - Right sidebar: AICE Score gauge, Maturity level, Badges cabinet
  - "Verified/Integrity" green badges on qualifying entries
  - "Next mission" card

### 5. Profile (`/profile/:id`)
**Desktop + Mobile**

- **Top:** AICE Score gauge (large, semicircle 0-100), Maturity level → Expert
- **Weekly trend:** Bar chart (M T W T F S S) showing daily score
- **Badges cabinet:** Grid of achievement badges (circular icons)
- **Next mission:** Card with current challenge + streak info ("12 Day Streak")
- **Score breakdown:** Domain pills — Clarity, Discipline, Coordination, Safety
  - Map to: TECH=Clarity, OPS=Discipline, ORCH=Coordination, COMMS+JUDGMENT=Safety (or keep our 5 domain names)
- **Mobile:** Same content stacked vertically

### 6. Share Card Generator (`/share`)
**Desktop + Mobile**

- **Left/Top:** Live preview of share card (AICE Score gauge + scores + avatar)
- **Right/Bottom:** Options
  - Gallery of card style variants
  - Toggle: Hide Username
  - Toggle: Hide exact score (rounded)
  - Toggle: Include QR code (optional, to hubaice.com profile)
  - Button: "Share preview" (green)
  - Button: "Download PNG" (red/accent)
  - Button: "Copy link" with link icon
  - Social icons: sharing to platforms

## Components Needed (new)

1. **ScoreGauge** — Semicircle gauge 0-100 with animated needle (SVG/canvas)
2. **MaturityBar** — Horizontal progress bar with labels (Novice → Expert)
3. **DailyChallenge** — Card with challenge text + streak badge
4. **FeedCard** — Social-style card with avatar, outcome, delta, tags, reactions
5. **BadgesCabinet** — Grid of circular achievement badges
6. **WeeklyTrendChart** — Bar chart 7 days (Recharts)
7. **ScoreBreakdown** — Domain pills with individual scores
8. **ShareCardPreview** — Live preview canvas for share card generation
9. **OnboardingFlow** — Multi-step wizard with icon/avatar grids

## Responsive Breakpoints
- Desktop: 1440px
- Mobile: 390px
- Tablet: interpolate

## Dark/Light Mode
- Dark = primary (default)
- Light = secondary
- Use CSS variables / Tailwind dark: prefix
- Toggle in header or system preference

## Domain Name Mapping (mockup → AICE)
The mockup uses generic names. Keep our real domain names:
- Clarity → TECH (🔧)
- Discipline → OPS (⚙️)
- Coordination → ORCH (🎯)
- Safety → split COMMS (💬) + JUDGMENT (🧠)
- **Decision needed from Sergio:** Use mockup's 4 domains or our 5?

## Notes
- Stats numbers (120K+, 4M+, 800+) are aspirational/placeholder
- Daily Challenge and Missions are NEW features not in current spec
- Badges system is NEW — needs backend support
- Feed with reactions (Helpful, Interesting) is NEW social feature
- Light mode is secondary but should work
