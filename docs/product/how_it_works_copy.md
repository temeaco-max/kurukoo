# Kurukoo — How It Works

**Page type:** Public user-facing explanation
**URL:** `/how-it-works`
**Audience:** People who want help getting things done, plus people who provide or operate services on Kurukoo

## Product promise

> **Kurukoo is a service that helps people get things done.**
>
> You tell Kurukoo what you need, want, notice, or are worried about.
>
> Kurukoo understands the situation, works out what it can do, takes appropriate action, gets help from people or services when necessary, keeps you informed, and remembers what matters.

The page should explain the experience in user language. Do not lead with technical architecture, marketplace terminology, internal lifecycle names, or a list of implementation components.

---

## 1. Hero

**Headline:**
Tell Kurukoo what you need. Let it help.

**Subhead:**
Start with a conversation. Kurukoo works out what you need, what it can do itself, what it needs from you, and when another person or service can help.

**CTA:**
Start chatting

**Supporting line:**
One Kurukoo. Many ways to get things done.

---

## 2. The experience

**Section headline:**
Start with what you need — not a form.

| Step | What you do | What Kurukoo does |
|---|---|---|
| 1 | Tell Kurukoo what you need in your own words. | Understands the situation and keeps the useful context together. |
| 2 | Answer anything it genuinely needs to know. | Uses available information, connected resources and relevant context so you do not repeat yourself unnecessarily. |
| 3 | Let Kurukoo help. | Gives advice, checks something, organises a task, finds an option, takes an authorised action, or starts the right kind of request. |
| 4 | Wait only when the work needs time or another participant. | Keeps the work moving and tells you when something needs your attention. |
| 5 | See what happened. | Reports the result clearly, including uncertainty or anything that still needs to be done. |

**Key message:**
Kurukoo handles the complexity where it can. You stay in control of important decisions and actions.

---

## 3. Kurukoo can help directly

**Section headline:**
Sometimes the fastest way to help is to do it with you.

Kurukoo should not send you to another person when it can safely solve the problem itself.

### Examples

**“My phone is running slowly. Check it.”**

When the device and permissions make diagnostics available, Kurukoo can inspect what it can, explain what it finds, offer safe fixes, and check whether the result improved the problem.

**“Check my Wi-Fi.”**

Kurukoo can use the diagnostics available from your device or connected network resources, explain what it can establish, and suggest or perform an appropriate next step when authorised.

**“My laptop won't connect to the printer.”**

Kurukoo can work through the problem using the information and tools available to it, rather than forcing you to select a support category first.

**“Keep an eye on this.”**

Where monitoring is supported, Kurukoo can continue the job and notify you when the agreed condition needs your attention.

**Important:** Kurukoo only claims what it can actually establish. Device and platform permissions, available tools, external services, safety requirements and evidence can affect what it is able to do.

---

## 4. When another person or service is needed

**Section headline:**
If Kurukoo cannot do it alone, it can help find who can.

**Body:**
A problem may need physical access, specialist equipment, a provider, a business, a delivery service, or another participant. Kurukoo can carry the useful context into the next step so you do not have to explain everything again.

### Example

> “My laptop won't charge.”

Kurukoo checks what it can. If the evidence points to a physical problem it cannot safely resolve remotely, it can tell you that plainly and ask whether you want it to find an appropriate repair provider.

If you agree, Kurukoo can use the supported request and provider flow to coordinate the next step, including obtaining a quote where that path is available.

---

## 5. It can work with more than one kind of thing

**Section headline:**
Your need comes first.

Kurukoo is not limited to phones or repairs. Depending on the available capabilities and services, you can ask it about:

- phones, tablets, laptops, desktops and other technology;
- Wi-Fi, networks and connected devices;
- TVs, cameras, smart devices and IoT resources;
- food, groceries and everyday purchases;
- rides, deliveries and errands;
- repairs and other skilled work;
- reminders, tasks and follow-ups;
- places, services, events and opportunities;
- products, sourcing and business services;
- people and providers who can help;
- work that needs to continue while you are away.

These are examples, not a fixed list of everything Kurukoo can become capable of helping with.

---

## 6. You do not need to know how it works

**Section headline:**
Just tell Kurukoo what you want done.

Kurukoo may use AI, skills, tools, connected resources, external services, providers, agents, memory, notifications or other systems behind the scenes. You do not need to choose which one.

What matters to you is:

**What can you do?**

**What do you need from me?**

**What happened?**

**What happens next?**

---

## 7. Kurukoo keeps you informed

**Section headline:**
You don't have to keep checking.

If you are in Chat, Kurukoo can show important updates there. If you are away, supported notifications or channels can let you know that something needs your attention.

When you come back, Kurukoo should show meaningful things that happened while you were away and let you continue the underlying work from the same place.

Examples:

> **Welcome back. Three things happened while you were away.**
>
> Laptop check completed.
>
> Repair quote received.
>
> Reminder due this afternoon.
>
> **Would you like an update?**

External channels are ways of reaching you, not separate Kurukoo assistants. Availability depends on the channel being configured and independently verified.

---

## 8. If Kurukoo needs your permission

**Section headline:**
You stay in control.

Kurukoo should ask for permission when access to a device, location, microphone, notifications, contacts, account, payment, external communication or consequential action genuinely requires it.

Permission should be requested when it becomes useful, not collected simply because Kurukoo might need it later.

For important actions, Kurukoo should make clear:

- what it wants to do;
- why it needs to do it;
- what will happen;
- what it cannot establish;
- and what you can choose instead.

---

## 9. For people who provide help

**Section headline:**
Kurukoo can bring work to you too.

Providers, businesses, contributors and other participants can describe what they can do. When a user needs that capability, Kurukoo can help coordinate the request and keep the relevant conversation and evidence together.

Providers can also use Kurukoo to help carry out work, understand a customer's requirements, follow appropriate instructions, record progress and return useful evidence.

The provider experience is part of the same service; it is not a disconnected marketplace workflow.

---

## 10. For people running Kurukoo

The internal operator experience is different from the consumer experience. Admin and operations surfaces should expose the detail needed to run the service: requests, lifecycle state, agents, tools, connected resources, providers, evidence, permissions, failures, external integrations, notifications, audits, recovery and deployment status.

Those surfaces operate on the same underlying Kurukoo state and are not another consumer product.

---

## FAQ

### What can I ask Kurukoo to do?
Start with what you need. Kurukoo can help with everyday questions and tasks, devices and technology, services, providers, purchases, travel, reminders, discovery, connected resources and other supported needs. Its capabilities grow through the same service rather than requiring a separate app for every category.

### Can Kurukoo fix my device?
Sometimes. If the device exposes the information and controls needed, Kurukoo can diagnose and safely resolve some problems. If the problem requires physical repair or another capability it does not have, Kurukoo can help you find someone who can.

### Does Kurukoo know what device I am using?
It can use device information that the current client, operating system and permissions make available. It should not claim access to information that the platform does not expose.

### Does Kurukoo always need a human provider?
No. Kurukoo should help directly when it can. A person or external service is brought in when the task genuinely requires one or when you choose that route.

### Will Kurukoo remember things?
When you choose to keep useful information in your profile, Kurukoo can use it to make future conversations and tasks more helpful. You remain in control of that information.

### What if Kurukoo cannot do something?
It should say so clearly, explain what it was able to establish, and offer the best available next step rather than pretending that the task was completed.

### How will I know when something happens?
Kurukoo can show updates in Chat and, where configured and permitted, use supported notifications or external channels. When you return, the same work can be continued from its canonical state.
