export type KanbanSmartTokenKind = "date" | "date-range" | "priority" | "assignee";
export type KanbanSmartPriority = "low" | "medium" | "high" | "urgent";

export interface KanbanSmartUser {
  id: string;
  name: string;
  username?: string | null;
}

export interface KanbanSmartToken {
  id: string;
  kind: KanbanSmartTokenKind;
  text: string;
  label: string;
  start: number;
  end: number;
}

export interface KanbanSmartInputResult {
  title: string;
  tokens: KanbanSmartToken[];
  startDate: string | null;
  dueDate: string | null;
  startDateHasTime: boolean;
  dueDateHasTime: boolean;
  priority: KanbanSmartPriority | null;
  assigneeUserIds: string[];
  errors: string[];
}

interface ParseKanbanSmartInputOptions {
  now?: Date;
  users?: KanbanSmartUser[];
  cancelledTokenIds?: Iterable<string>;
}

interface ParsedDateExpression {
  date: Date;
  hasTime: boolean;
}

interface ParsedDateTokenValue extends ParsedDateExpression {
  role?: "start" | "due";
}

const WEEKDAY_BY_TOKEN: Record<string, number> = {
  sunday: 0,
  sun: 0,
  воскресенье: 0,
  вс: 0,
  monday: 1,
  mon: 1,
  понедельник: 1,
  понедельника: 1,
  пн: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  вторник: 2,
  вторника: 2,
  вт: 2,
  wednesday: 3,
  wed: 3,
  среда: 3,
  среду: 3,
  среды: 3,
  ср: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  четверг: 4,
  четверга: 4,
  чт: 4,
  friday: 5,
  fri: 5,
  пятница: 5,
  пятницу: 5,
  пятницы: 5,
  пт: 5,
  saturday: 6,
  sat: 6,
  суббота: 6,
  субботу: 6,
  субботы: 6,
  сб: 6,
};

const DATE_TOKEN_PATTERN =
  "(?:today|tomorrow|сегодня|завтра|next\\s+week|следующ(?:ая|ей|ую)\\s+недел(?:я|е|ю)|(?:next\\s+|следующ(?:ий|ая|ую)\\s+)?(?:monday|mon|tuesday|tue(?:s)?|wednesday|wed|thursday|thu(?:r)?|friday|fri|saturday|sat|sunday|sun|понедельник(?:а)?|пн|вторник(?:а)?|вт|сред(?:а|у|ы)|ср|четверг(?:а)?|чт|пятниц(?:а|у|ы)|пт|суббот(?:а|у|ы)|сб|воскресенье|вс)|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[./]\\d{1,2}(?:[./]\\d{2,4})?)";
const TIME_PATTERN = "(?:[01]?\\d|2[0-3])[:.]\\d{2}";
const DATE_EXPRESSION_PATTERN = `${DATE_TOKEN_PATTERN}(?:\\s+(?:at\\s+|в\\s+)?${TIME_PATTERN})?`;

const pad = (value: number) => String(value).padStart(2, "0");

const toLocalValue = (date: Date, hasTime: boolean) => {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return hasTime ? `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}` : datePart;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const resolveNextWeekday = (now: Date, weekday: number, forceNextWeek: boolean) => {
  const currentDay = now.getDay();
  let distance = (weekday - currentDay + 7) % 7;
  if (distance === 0 || forceNextWeek) distance += 7;
  return addDays(startOfDay(now), distance);
};

const parseTrailingTime = (value: string) => {
  const match = value.match(new RegExp(`\\s+(?:at\\s+|в\\s+)?(${TIME_PATTERN})$`, "i"));
  if (!match) return null;
  const [hour, minute] = match[1].replace(".", ":").split(":").map(Number);
  return { hour, minute };
};

const parseDateExpression = (value: string, now: Date): ParsedDateExpression | null => {
  const normalized = value.trim().toLocaleLowerCase("ru");
  const time = parseTrailingTime(normalized);
  const datePart = normalized
    .replace(new RegExp(`\\s+(?:at\\s+|в\\s+)?${TIME_PATTERN}$`, "i"), "")
    .trim();
  let date: Date | null = null;

  if (datePart === "today" || datePart === "сегодня") {
    date = startOfDay(now);
  } else if (datePart === "tomorrow" || datePart === "завтра") {
    date = addDays(startOfDay(now), 1);
  } else if (/^(next\s+week|следующ(?:ая|ей|ую)\s+недел(?:я|е|ю))$/i.test(datePart)) {
    date = addDays(startOfDay(now), 7);
  } else {
    const explicitIso = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const explicitLocal = datePart.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
    if (explicitIso) {
      date = new Date(Number(explicitIso[1]), Number(explicitIso[2]) - 1, Number(explicitIso[3]));
    } else if (explicitLocal) {
      const rawYear = explicitLocal[3];
      const year = rawYear
        ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
        : now.getFullYear();
      date = new Date(year, Number(explicitLocal[2]) - 1, Number(explicitLocal[1]));
      if (!rawYear && date.getTime() < startOfDay(now).getTime()) {
        date.setFullYear(date.getFullYear() + 1);
      }
    } else {
      const forceNext = /^(next\s+|следующ(?:ий|ая|ую)\s+)/i.test(datePart);
      const weekdayToken = datePart.replace(/^(next\s+|следующ(?:ий|ая|ую)\s+)/i, "");
      const weekday = WEEKDAY_BY_TOKEN[weekdayToken];
      if (weekday !== undefined) date = resolveNextWeekday(now, weekday, forceNext);
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  if (time) date.setHours(time.hour, time.minute, 0, 0);
  return { date, hasTime: Boolean(time) };
};

const tokenId = (kind: KanbanSmartTokenKind, _start: number, text: string) =>
  `${kind}:${text.toLocaleLowerCase("ru")}`;

const priorityFromText = (value: string): KanbanSmartPriority | null => {
  const normalized = value.toLocaleLowerCase("ru");
  if (/(urgent|срочн|критич)/.test(normalized)) return "urgent";
  if (/(high|высок)/.test(normalized)) return "high";
  if (/(medium|normal|средн|обычн)/.test(normalized)) return "medium";
  if (/(low|низк)/.test(normalized)) return "low";
  return null;
};

const normalizeUserLookup = (value: string) =>
  value
    .trim()
    .replace(/^@/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru");

export const parseKanbanSmartInput = (
  input: string,
  options: ParseKanbanSmartInputOptions = {},
): KanbanSmartInputResult => {
  const now = options.now ? new Date(options.now) : new Date();
  const cancelled = new Set(options.cancelledTokenIds ?? []);
  const candidates: Array<KanbanSmartToken & { value: unknown }> = [];
  const errors: string[] = [];

  const rangeRegex = new RegExp(
    `(?:from\\s+|с\\s+)(${DATE_EXPRESSION_PATTERN})\\s+(?:to|until|до)\\s+(${DATE_EXPRESSION_PATTERN})`,
    "giu",
  );
  for (const match of input.matchAll(rangeRegex)) {
    const startValue = parseDateExpression(match[1], now);
    const endValue = parseDateExpression(match[2], now);
    if (!startValue || !endValue) continue;
    const start = match.index ?? 0;
    const text = match[0];
    candidates.push({
      id: tokenId("date-range", start, text),
      kind: "date-range",
      text,
      label: `${toLocalValue(startValue.date, startValue.hasTime)} → ${toLocalValue(endValue.date, endValue.hasTime)}`,
      start,
      end: start + text.length,
      value: { startValue, endValue },
    });
  }

  const dateRoleRegex = new RegExp(
    `(?:start|начало|старт|due|deadline|срок)\\s*[:=]?\\s*(${DATE_EXPRESSION_PATTERN})`,
    "giu",
  );
  for (const match of input.matchAll(dateRoleRegex)) {
    const start = match.index ?? 0;
    const text = match[0];
    const end = start + text.length;
    if (candidates.some((token) => token.kind === "date-range" && start < token.end && end > token.start)) {
      continue;
    }
    const value = parseDateExpression(match[1], now);
    if (!value) continue;
    const role = /^(?:start|начало|старт)/iu.test(text) ? "start" as const : "due" as const;
    candidates.push({
      id: tokenId("date", start, text),
      kind: "date",
      text,
      label: `${role === "start" ? "Старт" : "Срок"}: ${toLocalValue(value.date, value.hasTime)}`,
      start,
      end,
      value: { ...value, role } satisfies ParsedDateTokenValue,
    });
  }

  const occupiedByStructuredDate = (start: number, end: number) =>
    candidates.some((token) =>
      (token.kind === "date-range" || token.kind === "date") &&
      start < token.end &&
      end > token.start,
    );

  const dateRegex = new RegExp(DATE_EXPRESSION_PATTERN, "giu");
  for (const match of input.matchAll(dateRegex)) {
    const start = match.index ?? 0;
    const text = match[0];
    const end = start + text.length;
    if (occupiedByStructuredDate(start, end)) continue;
    const value = parseDateExpression(text, now);
    if (!value) continue;
    candidates.push({
      id: tokenId("date", start, text),
      kind: "date",
      text,
      label: `Срок: ${toLocalValue(value.date, value.hasTime)}`,
      start,
      end,
      value,
    });
  }

  const priorityRegex = /(?:!(?:low|medium|high|urgent)|(?:priority|приоритет)\s*[:=]?\s*(?:low|medium|normal|high|urgent|низк(?:ий|ая)?|средн(?:ий|яя)?|обычн(?:ый|ая)?|высок(?:ий|ая)?|срочн(?:ый|ая)?|критич(?:ный|ная)?)|(?:low|medium|high|urgent|низкий|средний|высокий|срочный|критичный)\s+(?:priority|приоритет))/giu;
  for (const match of input.matchAll(priorityRegex)) {
    const start = match.index ?? 0;
    const text = match[0];
    const value = priorityFromText(text);
    if (!value) continue;
    candidates.push({
      id: tokenId("priority", start, text),
      kind: "priority",
      text,
      label: `Приоритет: ${value}`,
      start,
      end: start + text.length,
      value,
    });
  }

  const users = options.users ?? [];
  const mentionRegex = /(^|\s)@([\p{L}\p{N}._-]+)/giu;
  for (const match of input.matchAll(mentionRegex)) {
    const mention = `@${match[2]}`;
    const start = (match.index ?? 0) + match[1].length;
    const lookup = normalizeUserLookup(mention);
    const user = users.find((candidate) =>
      [candidate.username, candidate.name]
        .filter(Boolean)
        .some((candidateValue) => normalizeUserLookup(String(candidateValue)) === lookup),
    );
    if (!user) continue;
    candidates.push({
      id: tokenId("assignee", start, mention),
      kind: "assignee",
      text: mention,
      label: `Исполнитель: ${user.name}`,
      start,
      end: start + mention.length,
      value: user.id,
    });
  }

  const tokens = candidates
    .filter((token) => !cancelled.has(token.id))
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((token, index, values) =>
      !values.slice(0, index).some((accepted) => token.start < accepted.end && token.end > accepted.start),
    );

  let startDate: string | null = null;
  let dueDate: string | null = null;
  let startDateHasTime = false;
  let dueDateHasTime = false;
  let priority: KanbanSmartPriority | null = null;
  const assigneeUserIds: string[] = [];

  for (const token of tokens) {
    const candidate = candidates.find((item) => item.id === token.id);
    if (!candidate) continue;
    if (token.kind === "date-range") {
      const { startValue, endValue } = candidate.value as {
        startValue: ParsedDateExpression;
        endValue: ParsedDateExpression;
      };
      startDate = toLocalValue(startValue.date, startValue.hasTime);
      dueDate = toLocalValue(endValue.date, endValue.hasTime);
      startDateHasTime = startValue.hasTime;
      dueDateHasTime = endValue.hasTime;
      if (startValue.hasTime && !endValue.hasTime) {
        errors.push("Если у начала указано время, у окончания оно тоже обязательно.");
      } else if (endValue.date.getTime() <= startValue.date.getTime()) {
        errors.push("Окончание должно быть позже начала.");
      }
    } else if (token.kind === "date") {
      const value = candidate.value as ParsedDateTokenValue;
      if (value.role === "start" && !startDate) {
        startDate = toLocalValue(value.date, value.hasTime);
        startDateHasTime = value.hasTime;
      } else if (!dueDate) {
        dueDate = toLocalValue(value.date, value.hasTime);
        dueDateHasTime = value.hasTime;
      }
    } else if (token.kind === "priority" && !priority) {
      priority = candidate.value as KanbanSmartPriority;
    } else if (token.kind === "assignee") {
      assigneeUserIds.push(String(candidate.value));
    }
  }

  if (startDate && dueDate) {
    if (startDateHasTime && !dueDateHasTime) {
      const message = "Если у начала указано время, у окончания оно тоже обязательно.";
      if (!errors.includes(message)) errors.push(message);
    } else if (new Date(dueDate).getTime() <= new Date(startDate).getTime()) {
      const message = "Окончание должно быть позже начала.";
      if (!errors.includes(message)) errors.push(message);
    }
  }

  const removedRanges = [...tokens].sort((left, right) => right.start - left.start);
  let title = input;
  for (const token of removedRanges) {
    title = `${title.slice(0, token.start)} ${title.slice(token.end)}`;
  }
  title = title.replace(/\s+/g, " ").trim();

  return {
    title,
    tokens,
    startDate,
    dueDate,
    startDateHasTime,
    dueDateHasTime,
    priority,
    assigneeUserIds: Array.from(new Set(assigneeUserIds)),
    errors,
  };
};

export const getKanbanMentionQuery = (input: string): string | null => {
  const match = input.match(/(?:^|\s)@([\p{L}\p{N}._-]*)$/u);
  return match ? match[1].toLocaleLowerCase("ru") : null;
};

export const insertKanbanMention = (input: string, usernameOrName: string): string =>
  input.replace(/(?:^|\s)@([\p{L}\p{N}._-]*)$/u, (match) => {
    const prefix = match.startsWith(" ") ? " " : "";
    return `${prefix}@${usernameOrName.replace(/\s+/g, ".")} `;
  });
