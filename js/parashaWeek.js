// Which parasha is this week's: the first one read on a Shabbat from today on,
// at most six days ahead (data/parasha.json weeks: [{ shabbat: 'YYYY-MM-DD', lesson }]).
import { localISO } from './dates.js';

export function parashaOfWeek(data, today = localISO()) {
  const weeks = (data?.weeks || []).slice().sort((a, b) => a.shabbat.localeCompare(b.shabbat));
  const days = (d) => Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  return weeks.find((w) => days(w.shabbat) >= 0 && days(w.shabbat) <= 6) || null;
}

// "שבת י' בכסלו" style label for the Shabbat, by the Hebrew calendar when the device knows it.
export function hebrewShabbat(iso) {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return `שבת ${new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)}`;
  } catch {
    return `שבת ${iso.split('-').reverse().join('.')}`;
  }
}
