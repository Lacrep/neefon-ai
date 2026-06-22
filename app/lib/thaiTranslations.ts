// Location name helpers for webcam display.
// Translation is currently disabled — names are shown as provided by the API.
// (A Thai subdistrict lookup table previously lived here but was unused dead
//  code with incorrect mappings, so it was removed.)

export function translateLocation(text: string | undefined): string {
  if (!text) return "--";

  // Translation disabled — return source text as-is.
  return text;
}
