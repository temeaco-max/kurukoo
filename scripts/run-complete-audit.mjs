import fs from 'fs';

const css = fs.readFileSync('public/css/site.css', 'utf8');
const lines = css.split('\n');

console.log(`site.css stats: ${lines.length} lines, ${(css.length / 1024).toFixed(1)} KB`);

// 1. Audit Retrofit block (lines 1705 - 1950) vs Original Rules
console.log('AUDIT CATEGORY 1: "AUDIT RETROFIT" DUPLICATE OVERRIDES');

const auditRetrofitDuplicates = [
  {
    name: '.card and .card:hover',
    original: 'Lines 800-814 (under /* Premium Card Style */)',
    duplicate: 'Lines 1710-1717 (under /* 2. Feature Cards */)',
    issue: 'Line 1710 re-declares .card with border-left and !important, and Line 1714 re-declares .card:hover with different shadow.'
  },
  {
    name: '.pricing-card.featured',
    original: 'Lines 839-844 (under /* Premium Card Style */)',
    duplicate: 'Lines 1720-1725 (under /* 3. Pricing Cards */)',
    issue: 'Line 1720 re-declares .pricing-card.featured with transform: scale(1.03), border-top: 3px solid !important, and box-shadow !important, duplicating/overriding lines 839-844.'
  },
  {
    name: '.nav-link:hover::after',
    original: 'Lines 109-112 (under /* Header Channel Badges */)',
    duplicate: 'Lines 1757-1760 (under /* 4. Header Scroll & Nav Link Underline */)',
    issue: '100% IDENTICAL rule: `transform: scaleX(1); transform-origin: left;` repeated at lines 109-112 and 1757-1760.'
  },
  {
    name: '@keyframes fadeInUp',
    original: 'Lines 1763-1766',
    duplicate: 'Lines 1880-1883 (@keyframes slideDownBanner), Lines 628-631 (@keyframes messageSlide), Lines 1113-1116 (@keyframes messageSlideIn)',
    issue: 'Identical keyframe animation bodies (`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`) defined with multiple identical names.'
  },
  {
    name: '.drawer & .drawer-toggle-bar span',
    original: 'Lines 1327-1377 (under /* Pull-down Drawer Style */)',
    duplicate: 'Lines 1798-1808 (under /* 7. Pull-Down Drawer & Drag Handle */)',
    issue: 'Lines 1798-1808 re-defines `.drawer` with transition: transform 300ms !important and re-defines `.drawer-toggle-bar span`.'
  },
  {
    name: '.floating-sos-btn and .floating-sos-btn:active',
    original: 'Lines 927-954 (under /* SOS Button & Modal Refinement */)',
    duplicate: 'Lines 1500-1516 and Lines 1834-1841 (under /* 9. Emergency SOS Pulse */)',
    issue: 'Repeated 3 times: initial definition lines 927-954, redundant re-declaration lines 1500-1516, and third re-declaration lines 1834-1841.'
  },
  {
    name: '.onboarding-step-view',
    original: 'Lines 1647-1649 (under /* Onboarding Overlays & Widgets */)',
    duplicate: 'Lines 1848-1850 (under /* 10. Onboarding Overlay Progress & Slide-Left */)',
    issue: 'Re-declares animation: slideLeft 300ms ease-out !important overriding animation: stepFadeIn 0.3s ease.'
  }
];

console.log(JSON.stringify(auditRetrofitDuplicates, null, 2));

// 2. Navigation & Header Component Redefinitions (lines 2037-2065 vs 2205-2313)
console.log('AUDIT CATEGORY 2: NAVIGATION & HEADER DUPLICATE BLOCKS');

const navDuplicates = [
  {
    name: '.globe-dropdown',
    first: 'Lines 2037-2039 (`position: relative;`)',
    second: 'Lines 2206-2211 (`position: relative; display: inline-flex; align-items: center; flex-shrink: 0;`)',
    issue: 'First declaration at lines 2037-2039 is incomplete and immediately superseded by lines 2206-2211.'
  },
  {
    name: '.nav-separator',
    first: 'Lines 2049-2053 (`width: 1.5px; height: 18px; background: rgba(61, 53, 46, 0.18);`)',
    second: 'Lines 2307-2313 (`width: 1px; height: 20px; background: rgba(217, 122, 92, 0.25); flex-shrink: 0; margin: 0 2px;`)',
    issue: 'Duplicated selector with conflicting dimensions and background colors.'
  },
  {
    name: '.nav-login-link-btn',
    first: 'Lines 2054-2065',
    second: 'Lines 2275-2292',
    issue: 'Duplicated selector with differing styles (padding, background, border, font-weight).'
  },
  {
    name: '.globe-btn:hover, .globe-btn.active & .nav-login-link-btn:hover, .nav-login-link-btn.active',
    first: 'Lines 2227-2232',
    second: 'Lines 2292-2297',
    issue: 'Identical body (`background: var(--terracotta); color: #ffffff; border-color: var(--terracotta);`) duplicated across two separate rules.'
  }
];

console.log(JSON.stringify(navDuplicates, null, 2));

// 3. Chat & Message Button Duplicates
console.log('AUDIT CATEGORY 3: CHAT BUTTONS & INPUT BAR DUPLICATES');

const chatDuplicates = [
  {
    name: '.chat-form',
    first: 'Lines 1053-1061',
    second: 'Lines 1252-1262',
    issue: 'Duplicated definition. First is static, second adds position: sticky; bottom: 0; and box-shadow.'
  },
  {
    name: '.voice-btn',
    first: 'Lines 1294-1297 (`background: var(--gray-100); color: var(--charcoal);`)',
    second: 'Lines 1312-1315 (`background: rgba(30, 136, 229, 0.1); color: var(--electric-blue);`)',
    issue: 'Second rule overrides the first rule immediately within 15 lines in the same section.'
  },
  {
    name: '.send-btn',
    first: 'Lines 1299-1302 (`background: var(--terracotta); color: var(--white);`)',
    second: 'Lines 1317-1320 (`background: var(--terracotta); color: var(--white);`)',
    issue: '100% IDENTICAL EXACT DUPLICATE declared twice within 15 lines.'
  }
];

console.log(JSON.stringify(chatDuplicates, null, 2));

// 4. Utility Classes Duplicated at Top vs Bottom
console.log('AUDIT CATEGORY 4: DUPLICATE UTILITY CLASSES');

const utilityDuplicates = [
  { name: '.text-center', lines: 'Line 878 vs Line 3621 (`text-align: center;`)' },
  { name: '.mt-16', lines: 'Line 883 vs Line 4656 (`margin-top: 16px;`)' },
  { name: '.gap-8', lines: 'Line 873 vs Line 4666 (`gap: 8px;`)' },
  { name: '.gap-16', lines: 'Line 875 vs Line 4664 (`gap: 16px;`)' },
  { name: '.p-0', lines: 'Line 885 (`padding: 0 !important;`) vs Line 4662 (`padding: 0;`)' },
  { name: '.border-none', lines: 'Line 886 (`border: none !important;`) vs Line 4699 (`border: none;`)' },
  { name: '.btn-whatsapp', lines: 'Lines 3506-3515 vs Lines 4534-4538' }
];

console.log(JSON.stringify(utilityDuplicates, null, 2));

// 5. Onboarding Duplicates: Semantic vs Auto-generated .onboard-st-*
console.log('AUDIT CATEGORY 5: ONBOARDING MODAL 1:1 DUPLICATES');

const onboardDuplicates = [
  { semantic: '.onboard-radio-label (Line 5016)', autoGenerated: '.onboard-st-46 (Line 5530)', match: '100% identical' },
  { semantic: '.selfhosted-wa-section (Line 5030)', autoGenerated: '.onboard-st-48 (Line 5542)', match: '100% identical' },
  { semantic: '.selfhosted-wa-title (Line 5051)', autoGenerated: '.onboard-st-51 (Line 5563)', match: '100% identical' },
  { semantic: '.selfhosted-wa-desc (Line 5057)', autoGenerated: '.onboard-st-52 (Line 5569)', match: '100% identical' },
  { semantic: '.selfhosted-fields (Line 5064)', autoGenerated: '.onboard-st-53 (Line 5576)', match: '100% identical' },
  { semantic: '.sh-label (Line 5077)', autoGenerated: '.onboard-st-55 (Line 5589)', match: '100% identical' },
  { semantic: '.sh-input (Line 5083)', autoGenerated: '.onboard-st-56 (Line 5595)', match: '100% identical' },
  { semantic: '.sh-assisted-card (Line 5091)', autoGenerated: '.onboard-st-57 (Line 5603)', match: '100% identical' },
  { semantic: '.sh-assisted-desc (Line 5106)', autoGenerated: '.onboard-st-60 (Line 5624)', match: '100% identical' },
  { semantic: '.onboard-submit-btn (Line 5113)', autoGenerated: '.onboard-st-61 (Line 5631)', match: '100% identical' },
  { semantic: '.ussd-success-title (Line 5142)', autoGenerated: '.onboard-st-64 (Line 5656)', match: '100% identical' },
  { semantic: '.ussd-dial-box (Line 5153)', autoGenerated: '.onboard-st-66 (Line 5667)', match: '100% identical' },
  { semantic: '.ussd-code-text (Line 5165)', autoGenerated: '.onboard-st-67 (Line 5679)', match: '100% identical' },
  { semantic: '.ussd-dial-btn (Line 5172)', autoGenerated: '.onboard-st-68 (Line 5686)', match: '100% identical' },
  { semantic: '.onboard-dismiss-btn (Line 5186)', autoGenerated: '.onboard-st-70 (Line 5700)', match: '100% identical' }
];

console.log(JSON.stringify(onboardDuplicates, null, 2));

// 6. Media Queries & Phone Mockup duplication
console.log('AUDIT CATEGORY 6: @MEDIA (MAX-WIDTH: 768px) DUPLICATES');

const mediaDuplicates = [
  {
    name: '@media (max-width: 768px) .phone-mockup',
    first: 'Lines 3323-3336',
    second: 'Lines 4442-4445 (`transform: scale(0.85); margin: -40px 0;`)',
    issue: 'The second definition at line 4442 overrides and conflicts with the first definition at line 3323.'
  },
  {
    name: 'Scrollbar hiding rules',
    selectors: [
      '@media (max-width: 768px) .scroll-x::-webkit-scrollbar (Line 620)',
      '.quick-replies-container::-webkit-scrollbar (Line 1049)',
      '#quick-replies-bar::-webkit-scrollbar (Line 1225)',
      '.channels-slider-container::-webkit-scrollbar (Line 2674)',
      '.inline-cards-slider::-webkit-scrollbar (Line 4385)'
    ],
    issue: '5 separate rules each with `display: none;` or `display: none !important;` - can be consolidated into a single `.no-scrollbar::-webkit-scrollbar` utility.'
  }
];

console.log(JSON.stringify(mediaDuplicates, null, 2));
