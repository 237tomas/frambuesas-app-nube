export const CHILE_TIME_ZONE = "America/Santiago";

type ChileDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getChileDateParts(date: Date): ChileDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(partMap.get("year")),
    month: Number(partMap.get("month")),
    day: Number(partMap.get("day")),
    hour: Number(partMap.get("hour")),
    minute: Number(partMap.get("minute")),
    second: Number(partMap.get("second")),
  };
}

function getChileOffsetMs(rawDate: Date): number {
  // El formateador descarta los milisegundos; se truncan antes de comparar.
  const date = new Date(Math.floor(rawDate.getTime() / 1000) * 1000);
  const { year, month, day, hour, minute, second } = getChileDateParts(date);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  return asUtc - date.getTime();
}

// Convierte una hora "de reloj" en Chile al instante UTC correspondiente.
// El segundo ajuste cubre los cambios de horario de verano.
export function chileDateToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetGuess = getChileOffsetMs(new Date(utcGuess));
  const offset = getChileOffsetMs(new Date(utcGuess - offsetGuess));

  return new Date(utcGuess - offset);
}

export function formatFechaChile(date: Date): string {
  return date.toLocaleString("es-CL", { timeZone: CHILE_TIME_ZONE });
}
