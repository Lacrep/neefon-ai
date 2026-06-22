// An OpenWeatherMap key is 32 hex chars. Warn if the field looks like another
// provider's key got pasted in (a recurring mix-up that silently breaks the
// temperature by forcing the Open-Meteo model fallback instead of OWM).
export function owmKeyWarning(s: {
  owmKey?: string;
  windyKey?: string;
  geminiKey?: string;
  tomorrowKey?: string;
}): string {
  const k = (s.owmKey ?? "").trim();
  if (!k) return "";
  if (k === s.windyKey || k === s.geminiKey || k === s.tomorrowKey)
    return "ค่านี้ซ้ำกับ API key ช่องอื่น — OWM key ต้องไม่เหมือน Windy/Gemini/Tomorrow";
  if (!/^[a-f0-9]{32}$/i.test(k))
    return "รูปแบบไม่เหมือน OpenWeatherMap key (ปกติเป็นอักขระ 0–9/a–f รวม 32 ตัว)";
  return "";
}
