# Kurukoo Service Execution Roadmap

**Status:** Active implementation roadmap  
**Date:** 27 August 2026  
**Product lens:** Kurukoo is a service that helps people get things done.

## Purpose

The repository already contains broad coordination, conversation, memory, agent, fulfilment, channel, device, and external-integration foundations. The remaining transformation is to make those foundations feel like one reliable service rather than a collection of technical surfaces. This roadmap translates the attached product report into repository-controlled action without creating a second universal agent, device OS, request lifecycle, notification system, memory system, provider directory, truth authority, or visual framework.

## Action backlog

| Priority | Report action | Repository action | State | Completion evidence |
|---|---|---|---|---|
| Highest | Make Chat the universal action surface | Keep canonical Chat as the entry point; route natural-language outcomes into existing canonical services; expose one truthful next action | In progress | Outcome routing and cross-domain continuation tests |
| Highest | Make the agent coordinate existing capabilities | Continue composing `agentRuntime`, capability contracts, context arbitration, canonical services, and Agent Brief; do not add a parallel orchestrator | In progress | Objective lifecycle, agent-control, and Agent Brief contracts |
| Highest | Make local capability useful without integrations | Prefer local inspection, guidance, memory, reminders, and bounded state; report unavailable providers only when needed | In progress | Local repair, device-support, memory, reminder, and external-boundary tests |
| Highest | Make device assistance broad | Treat device, network, printer, camera, TV, appliance, and IoT requests as outcome-first support; inspect connected resources when available, otherwise ask for the next useful evidence | In progress | Device-support route, connected-resource ledger, outcome-entity extraction |
| Highest | Finish the visual OS | Keep Desk, Chat, Requests, Tasks, Memory, Notifications, and Connect as supporting views of one job; prioritize service clarity over adding pages | In progress | Existing visual and surface contracts plus targeted UX passes |
| Next | Make return-to-Kurukoo excellent | Use canonical Agent Brief and notification continuation to present “what happened while you were away” with exact resumable actions | Foundation exists; next UX slice | `/api/agent/brief`, attention posture, continuation action contracts |
| Next | Make memory visibly useful | Show remembered preferences and request context at the moment they improve an outcome; preserve owner control and provenance | Foundation exists; next UX slice | Memory self-service and provenance contracts |
| Next | Unify Requests, Tasks, Notifications, and Memory | Keep canonical state separate internally but link every supporting view back to the originating conversation and next action | In progress | Desk hydration and cross-surface continuation contracts |
| Next | Make provider escalation seamless | Let Kurukoo explain when direct help is insufficient, ask permission, open one Economic Request, and continue the same conversation | Foundation exists; external verification remains | Provider inquiry and fulfilment integration contracts |
| Later | Expand commerce, discovery, physical execution, IoT, and autonomy | Extend existing canonical compositions only when a user outcome is supported and evidence boundaries remain explicit | Deferred by priority | Capability readiness and external activation reports |

## Product rules for implementation

The user should be able to begin with an intention such as “check my phone,” “remind me tomorrow,” “find someone to repair this,” or “keep an eye on this.” Kurukoo should determine the relevant path, use what is locally available, ask only for necessary information or permission, and report what actually happened.

A missing provider must not make unrelated local help appear broken. Conversely, configured credentials must not be described as live success without provider evidence. External payment, dispatch, notification, provider contact, channel pairing, object storage, and production infrastructure remain explicit activation boundaries.

Every new change must answer one acceptance question: **What can a person now ask Kurukoo to do that it could not reliably do before?** The implementation should then prove the result through the existing canonical service and regression contracts.

## Current implementation slice

The first service-focused slice restores the outcome-language extraction that was present on an earlier Manus branch but absent from the refreshed main path. It adds device, model, issue, network, subject, and outcome-verb context; fixes authenticated slow-device requests falling through to generic AI or economic storefront handling; returns a truthful device-support continuation when no connected resource is available; and keeps disabled trusted-contact SMS delivery in the correct `not_configured` state.

## Explicitly not claimed

This roadmap does not claim that Kurukoo has live access to a user device, that a device was diagnosed or repaired, that a provider was contacted, that payment or dispatch occurred, that a notification was delivered, or that an external channel is active. Those outcomes require the relevant runtime evidence and provider activation.
