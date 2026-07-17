import { z } from "zod";

export const calendarEventTypeSchema = z.object({
  value: z.string().trim().min(1).max(48).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  label: z.string().trim().min(1).max(64),
});

export const calendarEventTypeListSchema = z
  .array(calendarEventTypeSchema)
  .min(1)
  .max(24)
  .superRefine((items, context) => {
    const values = new Set<string>();
    items.forEach((item, index) => {
      const value = item.value.toLowerCase();
      if (values.has(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "value"],
          message: "Типы событий не должны повторяться",
        });
      }
      values.add(value);
    });
  });

export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;

export const DEFAULT_CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  { value: "stream", label: "Стрим" },
  { value: "recording", label: "Запись" },
  { value: "meeting", label: "Встреча" },
  { value: "maintenance", label: "Обслуживание" },
];

export function normalizeCalendarEventTypes(value: unknown): CalendarEventType[] {
  const parsed = calendarEventTypeListSchema.safeParse(value);
  if (!parsed.success) return DEFAULT_CALENDAR_EVENT_TYPES.map((item) => ({ ...item }));
  return parsed.data.map((item) => ({
    value: item.value.toLowerCase(),
    label: item.label.trim(),
  }));
}

export function createCalendarEventTypeValue(label: string, existing: CalendarEventType[]) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "event";
  const normalizedBase = base
    .normalize("NFKD")
    .replace(/[^a-z0-9-]/g, "") || `event-${existing.length + 1}`;
  const used = new Set(existing.map((item) => item.value));
  if (!used.has(normalizedBase)) return normalizedBase;
  let suffix = 2;
  while (used.has(`${normalizedBase}-${suffix}`)) suffix += 1;
  return `${normalizedBase}-${suffix}`;
}
