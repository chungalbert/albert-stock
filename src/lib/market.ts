export type SessionState = "open" | "closed" | "weekend";

function partsInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: map.weekday,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

function isWeekend(weekday: string) {
  return weekday === "Sat" || weekday === "Sun";
}

export function usSession(): SessionState {
  const { weekday, minutes } = partsInZone("America/New_York");
  if (isWeekend(weekday)) return "weekend";
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60 ? "open" : "closed";
}

export function twSession(): SessionState {
  const { weekday, minutes } = partsInZone("Asia/Taipei");
  if (isWeekend(weekday)) return "weekend";
  return minutes >= 9 * 60 && minutes < 13 * 60 + 30 ? "open" : "closed";
}

export function sessionLabel(state: SessionState): string {
  if (state === "open") return "開盤中";
  if (state === "weekend") return "週末休市";
  return "已收盤";
}
