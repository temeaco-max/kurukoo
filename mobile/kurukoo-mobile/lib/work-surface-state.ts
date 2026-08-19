export const WORK_SURFACE_STATE_KEY = "kurukoo.mobile.work-surfaces.v1";
export const REMINDER_DRAFTS_KEY = "kurukoo.mobile.reminder-drafts.v1";

export type ReminderDraft = { title: string; detail: string; time: string; date: string };

export function parsePausedWorkItems(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 50);
  } catch {
    return [];
  }
}

export function serializePausedWorkItems(items: string[]): string {
  return JSON.stringify(Array.from(new Set(items)).slice(0, 50));
}

export function parseReminderDrafts(raw: string | null): Record<string, ReminderDraft> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    return Object.fromEntries(entries.slice(0, 50).flatMap(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const draft = value as Record<string, unknown>;
      if (typeof draft.title !== "string" || typeof draft.detail !== "string" || typeof draft.time !== "string" || typeof draft.date !== "string") return [];
      return [[key, { title: draft.title.slice(0, 80), detail: draft.detail.slice(0, 240), time: draft.time.slice(0, 5), date: draft.date.slice(0, 10) }]];
    }));
  } catch {
    return {};
  }
}

export function serializeReminderDrafts(drafts: Record<string, ReminderDraft>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(drafts).slice(0, 50)));
}

export function validateReminderDraft(draft: ReminderDraft): string | null {
  if (draft.title.trim().length < 3) return "Add at least 3 characters for the reminder title.";
  if (draft.detail.trim().length < 10) return "Add at least 10 characters so the reminder keeps useful context.";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return "Use a 24-hour time such as 09:00 or 17:30.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "Choose a valid reminder date.";
  const scheduledAt = new Date(`${draft.date}T${draft.time}:00`);
  if (Number.isNaN(scheduledAt.getTime())) return "Choose a valid reminder date.";
  if (scheduledAt.getTime() <= Date.now()) return "Choose a future date and time.";
  return null;
}
