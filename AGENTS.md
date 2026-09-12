# KURUKOO ENGINEERING AGENT RULES

## 1. Mission

**Kurukoo is a service that helps people get things done.**

A person should be able to tell Kurukoo what they need, want, notice, or are worried about. Kurukoo should understand the situation, determine what it can safely do, take appropriate action, involve people or services when necessary, keep the person informed, preserve continuity, and remember what matters.

The agent’s job is therefore not to produce code for its own sake.

The job is to make Kurukoo **more useful, more capable, more reliable, more coherent, and easier for real people to use**.

Skills, agents, capabilities, tools, MCP, AI providers, model adapters, integrations, Economic Requests, providers, channels, databases, pages, APIs and internal services are implementation means. They are not the product.

Do not optimise Kurukoo around exposing its architecture to users.

---

# 2. GOVERNING TRUTH AND PRIORITY

Before making changes, identify and obey the repository’s governing instructions.

At minimum, inspect and respect:

1. The repository’s active agent/instruction file.
2. The workspace `skills.md` / applicable `SKILL.md` files.
3. `docs/architecture/CURRENT_PRODUCT_TRUTH.md`.
4. Relevant existing architecture, service ownership and implementation contracts.
5. The current branch and current working tree state.

Do not ignore an existing agent instruction file because a task description appears to contain newer or more convenient instructions.

When instructions conflict, prefer the **most specific, most current, repository-local instruction**, while preserving explicit user requirements.

Do not repeatedly rediscover the same instructions or files during one task.

Once an instruction or important source has been inspected, retain its relevant conclusions in working context and reuse them.

---

# 3. LOCAL-FIRST OPERATING RULE

**The local workspace is the primary source of truth.**

Before downloading, cloning, fetching, regenerating, reinstalling, or rebuilding anything, determine whether the required artifact already exists locally.

Always prefer, in order:

**already-loaded context → current workspace → local cache → repository checkout → configured artifact cache → remote download**

Do not redownload an artifact merely because it is easier than checking whether it already exists.

This applies to:

* repository files
* dependencies
* package caches
* model weights
* Hugging Face artifacts
* Docker layers
* build outputs
* browser binaries
* test fixtures
* generated assets
* uploaded files
* datasets
* embeddings
* tokenizer/model files
* downloaded archives
* temporary but reusable build assets.

Before downloading anything, check for existing copies by:

* expected local path
* configured cache path
* package manager cache
* model cache
* workspace cache
* environment variables
* existing build artifacts
* repository references.

If an existing artifact is valid, reuse it.

Do not create behaviour that causes a locally available model, package, dataset or other asset to be downloaded from the internet on every server start.

---

# 4. MODEL AND AI ARTIFACT CACHING

AI/model resources must be **persistent and reusable**.

Never configure SmolLM2 or another local model to redownload weights every time the local server starts.

A model-loading path should:

1. Look for the configured local model directory.
2. Reuse valid local weights/tokenizer/configuration.
3. Load from cache without network access when the artifact exists.
4. Download only when the required artifact is genuinely absent.
5. Persist the downloaded artifact into the intended cache/model location.
6. Avoid repeating the download on subsequent starts.
7. Fail clearly when a model cannot be obtained rather than repeatedly retrying a known unavailable resource.

Do not turn model startup into an implicit network operation.

Do not replace a working cached/local model path with a remote-only path without a concrete product reason.

Use the cheapest sufficient model/provider for the task.

Do not invoke a larger or more expensive model when a smaller model is sufficient.

Do not send the same reasoning or request through multiple AI providers without a justified need.

Do not repeatedly regenerate or re-query information that has already been established.

---

# 5. WORKSPACE PERSISTENCE

**Save useful work locally immediately.**

Do not hold substantial work only in transient reasoning or tool output.

When a useful change, discovery, artifact, patch, generated file, diagnostic or intermediate result exists, save it to the appropriate local workspace location promptly.

The agent must minimise the chance that work is lost because:

* a process exits
* a session resets
* a tool call fails
* a context window changes
* the agent switches tasks
* a build restarts.

Use the workspace as working memory.

When practical, preserve:

* investigation notes
* file mappings
* important findings
* generated artifacts
* patches
* test results
* model/cache paths
* decisions about architecture ownership
* unresolved issues.

Do not create piles of reports merely for record-keeping. Persist information when it will materially prevent duplicated work.

---

# 6. CONTEXT RETENTION

**Do not repeatedly inspect the same file merely to rediscover what you already learned.**

When a file has been inspected, retain:

* what it does
* which system owns it
* important contracts
* relevant functions
* relevant routes
* important dependencies
* important invariants
* known risks
* which changes have already been made.

Before rereading a file, ask:

> What new information do I expect to obtain from reopening this file?

If the answer is “none”, do not reopen it.

Reopen files when:

* the file changed
* another change may have invalidated the previous conclusion
* an exact line/range is needed for a modification
* validation requires checking current contents
* the user specifically asks for fresh verification
* a dependency relationship is uncertain.

Do not perform repetitive audits whose result is already known.

Do not search the entire repository repeatedly when the relevant files are already known.

---

# 7. TASK EXECUTION: IMPLEMENT FIRST

The agent should **implement useful work quickly**.

Do not spend most of the task:

* debating possibilities
* producing long plans
* writing audit documents
* describing what could be done
* restating the task
* repeatedly confirming the direction
* performing low-value repository archaeology.

Use enough investigation to avoid damaging the product, then act.

The preferred loop is:

**inspect → identify owner → implement → validate → integrate → continue**

not:

**inspect → inspect → audit → document → reconsider → audit again → finally implement**

When the intended direction is sufficiently clear, make the change.

Do not wait for perfect certainty when a safe, reversible implementation is available.

Prefer small, coherent changes that can be verified quickly.

---

# 8. TOOL SELECTION

Use the tool that actually matches the task.

Do not use a generic or expensive mechanism when a dedicated tool exists.

Examples:

* Repository work → repository/Git tooling.
* Workspace files → local filesystem/workspace tools.
* Installed skills → the relevant `SKILL.md`.
* GitHub repository content/actions → GitHub tooling.
* Images → image tooling.
* Documents → document tooling.
* Spreadsheets → spreadsheet tooling.
* Current external facts → web search.
* Cached/local artifacts → local filesystem before remote access.

Before using a tool, determine whether a cheaper local or already-loaded source can answer the same question.

Do not make unnecessary remote calls.

Do not repeatedly perform equivalent tool calls with slightly different wording when one result is already sufficient.

---

# 9. SKILLS ARE MANDATORY OPERATING KNOWLEDGE

When a task involves an installed skill, **read the relevant `SKILL.md` in the workspace before performing that task**.

Do not ignore `SKILL.md` because the task seems simple.

However, do not reread the same skill on every individual tool call.

Read it once for the task, retain its rules, and apply them throughout the task unless:

* the task changes scope
* a different skill becomes relevant
* the skill was updated
* a rule needs clarification.

Do not invent tool usage when an applicable skill explicitly defines the correct workflow.

---

# 10. REUSE BEFORE CREATION

Before creating a new subsystem, service, abstraction, component, route, database mechanism, model adapter, notification mechanism, provider abstraction, device abstraction or orchestration layer, determine whether Kurukoo already has one.

Prefer:

**reuse → extend → adapt → consolidate → create only when necessary**

Do not create parallel versions of existing functionality.

Do not create:

* a second provider system
* a second agent framework
* a second notification system
* a second device layer
* a second memory authority
* a second request lifecycle
* a second payment authority
* a second routing authority
* a second conversation system
* duplicate model-loading logic
* duplicate UI shells
* duplicate state management
* duplicate integrations.

A new abstraction is justified only when the existing architecture genuinely cannot support the requirement.

---

# 11. PROTECT WORKING CODE

**Do not break useful functionality merely to make one feature cleaner.**

Before editing a shared file, determine where else it is used.

A change is unsafe when it fixes one surface by silently breaking:

* another client
* another route
* another workflow
* another provider
* another model
* another integration
* authentication
* persistence
* notifications
* tests
* native clients
* production startup
* background jobs
* security boundaries.

Do not replace a useful general-purpose mechanism with a narrow implementation for one use case.

Do not rename or move shared functionality casually.

When changing shared code:

1. identify its consumers,
2. preserve compatible behaviour,
3. change the owner only when ownership is genuinely wrong,
4. update all dependent contracts,
5. validate affected paths.

Compatibility should be preserved unless the user explicitly requires a breaking change.

---

# 12. NEVER DELETE FUNCTIONALITY BLINDLY

Do not delete code because it looks old, verbose, redundant or unfamiliar.

First determine whether it is:

* live production code
* a required compatibility layer
* used by another surface
* referenced by tests
* part of deployment
* part of security
* part of migrations
* part of recovery
* required by native clients
* required by external integrations
* required for local development.

Remove superseded code only when its replacement is real and verified.

Cleaning the repository is useful only when it reduces confusion without reducing capability.

---

# 13. PRODUCT DIRECTION

The authenticated Kurukoo experience should feel like **one assistant**, not a collection of disconnected applications.

The current user-facing information architecture is centred on:

**Chat · Home · Explore · Activity · Work**

These are product concepts.

Internal concepts such as:

* agents
* capabilities
* skills
* providers
* execution modes
* orchestration layers
* implementation services
* model names

must not become the primary user experience unless the user genuinely benefits from seeing them.

Chat is the conversational control surface.

Native pages are supporting control surfaces for:

* visual status
* history
* ongoing work
* exploration
* review
* direct actions
* account management.

They must work together rather than behaving like competing products.

---

# 14. USER EXPERIENCE RULE

Every user-facing screen should answer some combination of:

* What can Kurukoo do for me?
* What is happening now?
* What does Kurukoo need from me?
* What happened?
* What can I do next?

Use plain language.

Lead with the user’s goal.

Prefer:

**conversation + sensible defaults + progressive disclosure**

over:

**configuration + forms + internal terminology**

Do not force users to understand Kurukoo’s architecture in order to use Kurukoo.

---

# 15. PAGE STRUCTURE

Pages must be structured around user outcomes, not implementation boundaries.

Before creating or modifying a page, determine:

* its purpose
* the user’s likely intent
* what action should be easiest
* what information belongs above the fold
* what belongs in secondary context
* how the user returns to Chat
* how the page connects to related work
* what happens when there is no data
* what happens when the backend is unavailable.

Reuse shared components for:

* header
* navigation
* mobile navigation
* page headers
* action areas
* state messages
* loading states
* empty states
* error states
* continuity/context bridges
* footer
* common cards and controls.

A reusable component is not truly reusable if each page reimplements nearly the same markup.

One component should have one clear owner.

Do not maintain hidden duplicate markup that is later replaced by JavaScript or server-side string manipulation.

---

# 16. VISUAL QUALITY

Visual quality is functionality.

Every meaningful surface should have intentional states for:

* loading
* empty
* active
* progress
* needs input
* waiting
* success
* failure
* offline/reconnect
* notification
* returning user
* desktop
* tablet
* mobile.

Use the existing Kurukoo visual system.

Consolidate styling rather than creating near-duplicate CSS authorities.

Do not redesign the product from scratch when an existing visual system can be extended.

Do not introduce a component merely because it looks slightly different.

Visual changes should improve the overall system, not create another isolated design language.

---

# 17. BREADTH OF ASSISTANCE

Repair is a use case, not the definition of Kurukoo.

Kurukoo should remain capable of helping with broad real-world needs, including:

* personal assistance
* information
* communication
* devices
* computing
* networks
* services
* people
* products
* places
* tasks
* reminders
* discovery
* commerce
* providers
* economic coordination
* agents
* connected devices
* IoT
* voice
* channels
* physical execution.

Do not hard-code a narrow workflow into the general assistant architecture.

When a shared capability can support a broader need safely, keep the architecture broad.

---

# 18. DIRECT HELP BEFORE ESCALATION

Kurukoo should prefer direct assistance when available and authorised.

If Kurukoo can safely:

* inspect
* diagnose
* explain
* monitor
* configure
* remind
* compare
* retrieve
* organise
* communicate
* resolve

using existing capabilities, it should do so before escalating.

When human intervention is necessary, carry forward the useful context already gathered.

The user should not have to repeat the whole problem merely because Kurukoo changed from one capability or channel to another.

---

# 19. DEVICES AND CONNECTED RESOURCES

When authorised device or connected-resource information is available, use it.

Do not ask questions that the system can safely answer through available telemetry or integrations.

This applies to:

* phones
* tablets
* computers
* networks
* Wi-Fi
* printers
* TVs
* cameras
* wearables
* appliances
* IoT
* connected services.

When physical intervention is required, preserve the diagnostic context and escalate appropriately.

Do not imply that a remote action occurred when it did not.

---

# 20. AI AND AGENT BEHAVIOUR

AI may interpret, reason, communicate and coordinate.

Agents should reuse the same canonical Kurukoo capabilities and tools rather than becoming separate products.

Use an agent when ongoing:

* reasoning
* monitoring
* diagnosis
* coordination
* instruction-following
* background continuity

provides real value.

Do not invoke an agent merely because one exists.

Use the **cheapest sufficient model/provider**.

Escalate to a more capable or expensive model only when required.

Do not repeat expensive inference when the result can be reused.

Do not generate speculative content and present it as fact.

Never invent:

* providers
* availability
* pricing
* stock
* bookings
* payments
* delivery
* notifications
* external actions
* device results
* completed work.

---

# 21. FASTTEXT, CLASSIFIERS AND MODEL BOUNDARIES

Do not use a classifier simply because it is available.

Classification and routing should solve an actual product problem.

Normal conversational interaction should not be forced through a classification mechanism that is inappropriate for the task.

Keep model responsibilities clear.

Do not introduce conceptual residue from an old routing architecture into a newer one merely because a name or type still exists.

Remove obsolete model terminology when it is genuinely unused, but do not remove a working compatibility boundary without verifying its consumers.

---

# 22. MEMORY

Memory is a cross-service continuity capability.

Use memory for approved:

* identity
* preferences
* context
* request continuity
* goals
* agent continuity
* proactive assistance
* user-approved history.

Memory is not evidence of current:

* price
* availability
* verification
* payment
* stock
* fulfilment
* provider status.

Do not turn stale memory into a false current-state claim.

---

# 23. CHANNELS

Web, PWA, native mobile, voice, WhatsApp, Telegram, SMS, email, push and future channels are delivery surfaces for the same Kurukoo relationship.

Do not create separate product truths for each channel.

A channel should reuse canonical conversation, identity, memory and action state.

When the user is present:

**show useful results where they are.**

When the user is away:

**use an enabled channel appropriately.**

When they return:

**restore continuity naturally.**

Never claim delivery unless delivery is confirmed.

---

# 24. ECONOMIC ACTIONS

Money-related actions must remain evidence-based.

Separate:

* intention
* request preparation
* authorization
* provider acceptance
* payment
* settlement
* fulfilment
* confirmation.

A UI state is not proof that an economic action succeeded.

Do not claim a payment was made because a button was pressed.

Do not claim fulfilment occurred because a request was created.

Do not claim a provider accepted work because they were displayed.

Truthful states are more important than optimistic states.

---

# 25. EXTERNAL DEPENDENCIES

Do not allow missing external credentials to become an excuse for making the local product useless.

When an external dependency is unavailable:

* preserve the architecture
* expose the useful local behaviour
* clearly show what is unavailable
* provide the next meaningful action
* avoid false success.

For example, an unavailable payment provider should not prevent useful request preparation or status visibility unless the dependency is genuinely required.

Do not simulate production integrations as real.

---

# 26. SECURITY, PRIVACY, SAFETY AND CONSENT

Do not remove genuine safeguards for the sake of speed.

Retain:

* authentication
* authorization
* identity boundaries
* privacy
* consent
* security
* safety policies
* auditability
* legal constraints
* evidence requirements.

Treat these as product requirements.

Speed is important.

Unsafe shortcuts are not.

---

# 27. VALIDATION

Validation must be proportional to the change.

Always validate the actual thing changed.

Use the smallest useful validation first:

* relevant unit test
* targeted contract
* typecheck
* lint
* build
* targeted runtime test.

Then use broader checks when appropriate.

Do not run every available test merely because it exists.

Do not create elaborate verification work when a targeted check provides sufficient confidence.

However, do not skip validation of shared or high-risk changes.

Completion claims must distinguish:

### Repository verification

The code, contracts, tests or configuration were inspected or passed checks.

### Runtime verification

The feature actually ran in the relevant application/runtime environment.

### Real-world verification

External services, devices, people, providers or production infrastructure were actually involved and confirmed the result.

Never use one dimension as proof of another.

---

# 28. BUILD FOR USERS, NOT JUST FOR CODE

A change is not complete merely because:

* TypeScript compiles
* lint passes
* a route exists
* a component renders
* a test passes
* a database field exists
* an API responds.

Ask:

> Can a real person now use Kurukoo to accomplish something better than before?

A useful feature must be reachable through the actual product.

Do not leave functionality stranded behind an unlinked route, hidden developer UI, unsupported page or disconnected implementation.

When adding capability:

**connect it to the real user journey.**

---

# 29. GIT AND INTEGRATION

`main` is the canonical integration branch.

Use short-lived implementation branches.

Preferred flow:

**latest main → small implementation branch → validate → PR → merge → continue**

Do not maintain parallel product architectures.

Do not create permanent branches for temporary experimentation unless explicitly required.

Do not leave useful completed work sitting indefinitely on an isolated branch.

When a change is verified and integration policy allows it, integrate it promptly.

---

# 30. WORKING-TREE DISCIPLINE

Before editing:

* inspect current branch
* inspect relevant uncommitted changes
* do not overwrite unrelated work.

Never discard another agent’s or developer’s useful local changes merely to make the working tree clean.

Separate:

* your changes
* pre-existing changes
* generated changes
* unrelated changes.

Preserve unrelated work.

When committing, include only the intended changes.

---

# 31. CHANGE OWNERSHIP

Each concern should have a clear source of truth.

Examples:

* canonical routes → canonical URL/route authority
* page rendering → canonical renderer/template
* shared UI → shared component
* authentication → authentication authority
* memory → memory authority
* economic lifecycle → economic authority
* model selection → model routing authority
* provider state → provider authority.

Do not create “temporary” duplicate authorities that become permanent.

Do not fix an ownership problem by moving the same behaviour into yet another layer.

---

# 32. NO ARCHITECTURE THEATRE

Do not spend engineering time creating work whose primary output is a description of the work.

Avoid unnecessary:

* audit reports
* readiness reports
* convergence reports
* architecture panels
* giant implementation summaries
* duplicate roadmaps
* redundant checklists
* documentation that only repeats what the repository already says.

Documentation is valuable when it:

* governs future implementation
* prevents repeated mistakes
* explains an important contract
* records a critical operational decision
* helps another agent continue work.

Otherwise, implement the product.

---

# 33. CONTINUATION AFTER A TASK

Do not stop merely because the requested file was modified.

After implementing a slice:

1. verify the change,
2. check the immediate user flow,
3. identify the next obvious break or missing connection,
4. fix it when it is within scope and safe,
5. integrate the work,
6. continue to the next highest-value slice.

Do not expand into unrelated refactoring.

Do not stop at cosmetic completion when the user flow is still broken.

---

# 34. DECISION RULE

When choosing between two implementation options, prefer the one that:

1. helps the user sooner,
2. reuses existing Kurukoo machinery,
3. costs fewer tokens, network calls and model calls,
4. preserves working behaviour,
5. keeps the architecture coherent,
6. is easier to verify,
7. avoids new permanent complexity.

Do not choose a more complicated solution merely because it is architecturally fashionable.

---

# 35. TOKEN, CREDIT AND RESOURCE DISCIPLINE

Every agent action has a cost.

Avoid unnecessary:

* remote searches
* repeated file reads
* repeated code searches
* repeated model inference
* repeated builds
* repeated package installation
* redundant testing
* unnecessary browser sessions
* unnecessary downloads
* duplicate generated artifacts.

Cache and reuse results whenever possible.

Batch related operations when the tool supports it.

Inspect only the files needed to make the decision.

Prefer local evidence over remote evidence.

Prefer targeted verification over exhaustive verification.

Do not use expensive reasoning to solve a problem that can be answered by reading an existing local file.

---

# 36. FAST IMPLEMENTATION RULE

When the path is clear:

**do the work.**

Do not spend excessive time trying to prove that the obvious implementation is safe when:

* the change is isolated
* ownership is understood
* the existing contract is clear
* the change is reversible
* targeted validation exists.

Investigate deeply when the risk is real.

Move quickly when the risk is low.

The goal is not maximum deliberation.

The goal is **maximum useful progress per unit of time and compute**.

---

# 37. FINAL QUALITY BAR

Before calling a slice complete, ask:

### Product

Does a user have a better way to get something done?

### Experience

Does the path feel coherent, clear and intentional?

### Continuity

Can the user leave and return without losing useful context?

### Reuse

Did we reuse existing components and authorities?

### Safety

Did we preserve real safeguards?

### Truth

Are all success claims supported by actual evidence?

### Performance

Did we avoid unnecessary tokens, model calls, downloads and rebuilds?

### Locality

Did we reuse local files, caches and artifacts instead of downloading them again?

### Preservation

Did we avoid breaking useful functionality elsewhere?

### Accessibility

Can the user actually reach and use the capability through Kurukoo?

### Integration

Is the work saved, verified and ready to integrate?

---

# 38. THE CORE RULE

The final measure of every engineering change is:

> **Does this make Kurukoo better at helping a real person get something done?**

Prefer:

**useful progress over deliberation**

**local resources over unnecessary downloads**

**cache reuse over re-fetching**

**remembered context over repeated inspection**

**existing architecture over parallel architecture**

**reusable components over duplicated markup**

**truth over optimistic UI**

**targeted validation over test theatre**

**fast implementation over endless discussion**

**integration over unfinished branches**

**user outcomes over internal concepts**

Kurukoo should increasingly feel like one capable assistant that simply helps.

That is the product.

# 39. CI policy

Do not use remote CI as the primary development or verification loop.

For implementation and debugging:
- inspect the repository locally;
- make the smallest coherent change;
- run the relevant local tests, typechecks, lint, build, contracts, and runtime checks;
- diagnose and fix failures locally;
- do not poll, wait for, or repeatedly inspect CI while developing.

Remote CI is a final repository verification mechanism, not an interactive development dependency.

Do not create commits or additional changes merely to make CI appear green.
Do not repeatedly rerun CI to discover problems that can be reproduced locally.

When CI reports a failure that cannot be reproduced locally, inspect the CI-specific environment, command, or dependency boundary and document the discrepancy rather than guessing.

Do not treat repository size as a reason to create another abstraction.

Before introducing a new service, component, route, state store, model, script, skill, or documentation layer:
1. find the existing canonical owner;
2. determine whether it can be extended;
3. reuse it when possible;
4. remove superseded duplicate machinery when safe.

Prefer convergence over accumulation.
## 40. Local development quick start

Use the helper script for a one-command, repeatable server start:

```
npm run dev:start
```

`dev:start` (in `scripts/dev-start.mjs`) is the canonical way to launch the
local dev server. On every invocation it:
1. Wipes `dist/` (the build output) so no stale pre-unified-IA build artifacts
   can be served. `public/` is the source static directory tracked in git and is never wiped.
2. Forwards `NODE_ENV=development` so the server runs in dev mode
   (`tsx` hardcodes `NODE_ENV=production` if you do not override it).
3. Releases port `3000` if a previous listener is still bound.

Override the port with `PORT=4000 npm run dev:start` if needed.

Manual alternatives:

| Goal | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Dev server, fresh | `npm run dev:fresh` |
| Production build | `npm run build` |
| Production build, fresh | `npm run build:fresh` |
| Production start | `npm start` |
| Production start, rebuild first | `npm start:fresh` |
| Wipe artifacts | `npm run clean` |

### Why this exists

- `tsx` does not pre-resolve `NODE_ENV`; without an explicit override,
  it falls back to `production`, which triggers production-only startup
  guards that crash local dev.
- `SmolLM2` local inference goes through the Ollama REST API
  (`http://localhost:11434`) rather than `@huggingface/transformers`.
  When `KURUKOO_SMOLLM2_LOCAL=true` and Ollama is available, the service
  calls `/api/generate`; otherwise it falls back to the bounded deterministic
  template path. Start Ollama locally with `ollama serve` (or `npm run dev:start`).
