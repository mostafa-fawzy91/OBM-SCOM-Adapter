import { DateTime } from 'luxon';

const SUPPORTED_FORMATS = [
  "M/d/yyyy HH:mm:ss",
  "M/d/yyyy h:mm:ss a",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm:ss.SSS",
  "yyyy-MM-dd HH:mm:ss",
  "dd/MM/yyyy HH:mm:ss",
  "EEE MMM dd HH:mm:ss yyyy",
];

export class DateTimeUtils {
  static normalize(value?: string): string | undefined {
    if (!value) return undefined;

    for (const fmt of SUPPORTED_FORMATS) {
      const parsed = DateTime.fromFormat(value, fmt, { zone: 'utc' });
      if (parsed.isValid) {
        return parsed.toUTC().toISO();
      }
    }

    const fromIso = DateTime.fromISO(value, { zone: 'utc' });
    if (fromIso.isValid) {
      return fromIso.toUTC().toISO();
    }

    return undefined;
  }

  static nowIso(): string {
    return DateTime.utc().toISO();
  }
}

