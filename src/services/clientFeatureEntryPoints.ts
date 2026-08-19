export type FeatureEntrypoint = {
  id: string;
  label: string;
  description: string;
  publicPath: string;
  authenticatedPath: string;
  primarySurface: 'chat' | 'explore' | 'discover' | 'topics' | 'tasks' | 'connect' | 'wallet' | 'safety';
};

/** Historical/product breadth inventory. These are entrypoints into the canonical OS, not independent transaction engines. */
const RAW_FEATURE_ENTRYPOINTS: ReadonlyArray<[string, string, string, string, string, FeatureEntrypoint['primarySurface']]> = [
  ['food','Order food','Food and grocery requests begin in Chat or Explore.','/explore/food','/chat?prompt=I%20need%20food','explore'],
  ['groceries','Get groceries','Groceries reuse the food/vendor request flow.','/explore/food','/chat?prompt=I%20need%20groceries','explore'],
  ['errands','Get errands done','Errands and local delivery use the shared request lifecycle.','/explore/errands-delivery','/chat?prompt=I%20need%20an%20errand','explore'],
  ['logistics','Logistics and delivery','Parcel, runner and logistics coordination use the shared request lifecycle.','/explore/logistics','/chat?prompt=I%20need%20delivery','explore'],
  ['parcels','Send parcels','Parcel movements are logistics requests, not a separate app.','/explore/logistics','/chat?prompt=I%20need%20to%20send%20a%20parcel','explore'],
  ['fuel','Fuel delivered','Fuel delivery enters through errands/logistics and remains evidence-gated.','/explore/errands-delivery','/chat?prompt=I%20need%20fuel%20delivered','explore'],
  ['mobility','Ride and mobility','Rides use Discover plus the shared request/fulfilment fabric.','/discover','/chat?prompt=I%20need%20a%20ride','discover'],
  ['home-services','Home services','Home services reuse the provider/capability flow.','/explore/repairs','/chat?prompt=I%20need%20home%20services','explore'],
  ['repairs','Repairs and maintenance','Repair requests reuse canonical provider matching and Economic Requests.','/explore/repairs','/chat?prompt=I%20need%20a%20repair','explore'],
  ['solar','Solar installation','Solar services reuse professional-services capability flows.','/explore/professional-services','/chat?prompt=I%20need%20solar%20installation','explore'],
  ['automotive','Auto repair and parts','Auto work uses capability/provider discovery and product/request flows.','/explore/automotive-care','/chat?prompt=I%20need%20auto%20repair%20or%20car%20parts','explore'],
  ['health','Health and care','Non-emergency health coordination remains safety-bound and conversational.','/explore/health','/chat?prompt=I%20need%20health%20help','explore'],
  ['money-circle','Money Circle / Ajo','Money Circle is a conversational finance/community capability, not a second wallet system.','/explore/finance-tax','/chat?prompt=Tell%20me%20about%20Money%20Circle','explore'],
  ['emergency','Safety / urgent help','Urgent situations use the safety boundary and never imply emergency-service fulfilment.','/explore/emergency','/app/safety','safety'],
  ['security','Security and close protection','Security needs use provider/capability discovery with evidence and policy gates.','/explore/safety-security','/chat?prompt=I%20need%20security%20support','explore'],
  ['neighborhood-safety','Neighborhood safety alerts','Community safety context belongs to Topics/Discover/Safety, not a second alert platform.','/topics','/app/safety','topics'],
  ['gigs','Find work and gigs','Work discovery and execution use the capability/task fabric.','/explore/gigs','/chat?prompt=Help%20me%20find%20work','tasks'],
  ['classifieds','Sell locally','Selling uses conversational discovery and the provider-neutral offer/request fabric.','/explore/classifieds','/chat?prompt=I%20want%20to%20sell%20something%20locally','explore'],
  ['advertising','Reach customers / advertise','Advertising remains a separate commercial surface connected to the network.','/advertise','/advertise','explore'],
  ['contributors','Cover events / get paid','Contributor opportunities become Tasks and capability work.','/resources','/app/tasks','tasks'],
  ['sports','Sports, matches and clubs','Sports uses Explore plus Topics/Discover where community context exists.','/explore/sports-recreation','/chat?prompt=Tell%20me%20about%20sports%20and%20clubs','explore'],
  ['circles','Community and groups','Community groups use Topics and the shared conversation rather than a second social graph.','/topics','/app/topics','topics'],
  ['price-alerts','Price alerts / price checks','Price checks remain conversational information requests unless an evidence-backed source exists.','/explore/price-checker','/chat?prompt=Help%20me%20check%20a%20price','explore'],
  ['government','Key government services','Government guidance/checks are capability/knowledge requests with external verification when needed.','/explore/government','/chat?prompt=Help%20me%20with%20a%20government%20service','explore'],
  ['exam-results','Exam results','Exam result requests use the education/knowledge flow; no result is fabricated.','/explore/education','/chat?prompt=Help%20me%20check%20an%20exam%20result','explore'],
  ['airtime-data','Airtime and data','Airtime/data actions are payment/execution capabilities and stay feature-flagged until the provider rail is active.','/explore/communication','/chat?prompt=I%20need%20airtime%20or%20data','chat'],
  ['universal-remote','Universal remote / devices','Device control uses the existing IoT/device bridge and remains feature-flagged.','/resources','/app/connect','connect'],
  ['events','Events and what is happening','Events are surfaced through Discover and community context.','/discover','/chat?prompt=What%20is%20happening%20near%20me%3F','discover'],
  ['hawkers','Nearby local sellers / hawkers','Local sellers surface through Discover/Explore/Topics when evidence and consent allow.','/discover','/chat?prompt=Find%20something%20local%20near%20me','discover'],
  ['prayer','Prayer and spiritual support','Prayer is a first-class agent using the canonical Agent Runtime, voice and artifacts.','/explore/spiritual','/app/prayer','chat'],
];

export const CLIENT_FEATURE_ENTRYPOINTS: readonly FeatureEntrypoint[] = RAW_FEATURE_ENTRYPOINTS.map(([id, label, description, publicPath, authenticatedPath, primarySurface]) => ({ id, label, description, publicPath, authenticatedPath, primarySurface }));

export function getFeatureEntrypoint(id: string): FeatureEntrypoint | undefined {
  return CLIENT_FEATURE_ENTRYPOINTS.find((feature) => feature.id === id);
}
