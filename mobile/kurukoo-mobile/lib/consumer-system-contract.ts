export const CONSUMER_SYSTEM_CONTRACT = {
  version: 1,
  product: "Kurukoo OS",
  systems: {
    webConsumer: {
      platforms: ["web-app", "pwa"],
      visualFamily: "web",
      composition: ["persistent_workspace_rail", "conversation_or_surface_main", "context_inspector", "hover_keyboard_feedback"],
      responsiveAdaptation: ["collapse_rail", "stack_context", "preserve_web_shell", "retain_desktop_information_density"],
      prohibited: ["native_bottom_tab_shell_as_primary_navigation", "safe_area_padding_as_layout_authority", "native_camera_or_audio_controls_as_web_shell"],
    },
    nativeConsumer: {
      platforms: ["ios", "android"],
      visualFamily: "native",
      composition: ["safe_area_screen", "touch_first_controls", "one_column_conversation", "cards_or_sheets", "native_audio_camera_controls"],
      responsiveAdaptation: ["one_handed_reachability", "bottom_action_visibility", "platform_back_behavior", "native_permission_surfaces"],
      prohibited: ["desktop_workspace_rail_as_primary_navigation", "persistent_web_context_inspector_grid", "web_route_shell_classes"],
    },
  },
  sharedSemantics: {
    lifecycleStates: ["empty", "loading", "streaming", "completed", "stopped", "error", "unavailable", "ready", "paused", "queued"],
    capabilityKinds: ["chat", "voice", "storage", "agents", "opportunities", "network", "artifacts", "notifications"],
    providerReadiness: ["ready", "setup_required", "unavailable", "pending_verification", "verified"],
    truthBoundaries: ["internal_only", "mock_only", "credential_required", "live_verified", "production_active"],
  },
  boundaryContracts: {
    webRootsMustDeclare: ["data-visual-family=web", "route-style-manifest"],
    pwaRootsMustDeclare: ["data-visual-family=web", "route-style-manifest"],
    nativeSourceMustNotContain: ["k-shell", "k-nav", "workspace-nav", "partner-authority-shell", "kurukoo-chat-page"],
    embeddedPreviewsMustDeclare: ["data-contained-surface=native-preview", "data-preview-family=mobile"],
  },
} as const;

export type ConsumerVisualFamily = keyof typeof CONSUMER_SYSTEM_CONTRACT.systems;
export type SharedLifecycleState = (typeof CONSUMER_SYSTEM_CONTRACT.sharedSemantics.lifecycleStates)[number];
export type CapabilityKind = (typeof CONSUMER_SYSTEM_CONTRACT.sharedSemantics.capabilityKinds)[number];
export type ProviderReadiness = (typeof CONSUMER_SYSTEM_CONTRACT.sharedSemantics.providerReadiness)[number];
export type TruthBoundary = (typeof CONSUMER_SYSTEM_CONTRACT.sharedSemantics.truthBoundaries)[number];
