export const CONSUMER_STATE_FIXTURES = [
  { id: "empty", surface: "chat", lifecycle: "empty", requiredVisible: "welcome,quick_actions,composer" },
  { id: "loading", surface: "chat", lifecycle: "loading", requiredVisible: "loading_indicator,composer" },
  { id: "streaming", surface: "chat", lifecycle: "streaming", requiredVisible: "typing_indicator,stop_control,partial_message" },
  { id: "completed", surface: "chat", lifecycle: "completed", requiredVisible: "message_actions,context_state,composer" },
  { id: "error", surface: "chat", lifecycle: "error", requiredVisible: "error_message,retry_control,composer" },
  { id: "unavailable", surface: "provider", lifecycle: "unavailable", requiredVisible: "truthful_unavailable_copy,setup_or_retry_action" },
  { id: "ready", surface: "capability", lifecycle: "ready", requiredVisible: "readiness_state,primary_action" },
  { id: "paused", surface: "agent", lifecycle: "paused", requiredVisible: "paused_state,resume_control" },
  { id: "queued", surface: "voice", lifecycle: "queued", requiredVisible: "queued_count,retry_now_action" },
  { id: "completed-artifact", surface: "artifact", lifecycle: "completed", requiredVisible: "provider_label,play_or_open_action,delete_reference_action" },
] as const;

export type ConsumerStateFixture = (typeof CONSUMER_STATE_FIXTURES)[number];
export type ConsumerStateId = ConsumerStateFixture["id"];
