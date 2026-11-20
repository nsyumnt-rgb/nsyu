/**
 * Category alias code resolver:
 * Matches user requirements:
 *   charger -> CH
 *   Car charge / Car charger -> CH
 *   Neck BAnd / Neckband -> NB
 *   Power Bank Charger / Power Bank -> PB
 * With smart abbreviations for other categories and support for custom alias.
 */
export function getCategoryAlias(
  categoryName?: string | null,
  customAlias?: string | null
): string {
  if (customAlias && customAlias.trim()) {
    return customAlias.trim().toUpperCase();
  }
  if (!categoryName) return "GEN";

  const norm = categoryName.trim().toLowerCase();

  // User-requested exact mappings:
  // "Car charge -> CH" (must evaluate before generic "charger")
  if (norm.includes("car charge") || norm.includes("car charger")) {
    return "CH";
  }
  // "Power Bank Charger -> PB" or "Power Bank"
  if (norm.includes("power bank") || norm.includes("powerbank")) {
    return "PB";
  }
  // "Neck BAnd -> NB" or "Neckband"
  if (norm.includes("neck band") || norm.includes("neckband") || norm.includes("neck-band")) {
    return "NB";
  }
  // "charger -> CH"
  if (
    norm === "charger" ||
    norm === "chargers" ||
    norm.includes("charger") ||
    norm.includes("charging") ||
    norm.includes("adapter")
  ) {
    return "CH";
  }

  // Smart abbreviations for other common product categories:
  if (norm.includes("earphone") || norm.includes("airpod") || norm.includes("tws") || norm.includes("earbud")) {
    return "EP";
  }
  if (norm.includes("headphone") || norm.includes("headset")) {
    return "HP";
  }
  if (norm.includes("smart watch") || norm.includes("smartwatch") || norm.includes("watch")) {
    return "SW";
  }
  if (norm.includes("cable") || norm.includes("data cable") || norm.includes("wire")) {
    return "CB";
  }
  if (norm.includes("tempered") || norm.includes("glass") || norm.includes("screen protector")) {
    return "TG";
  }
  if (norm.includes("cover") || norm.includes("case") || norm.includes("pouch")) {
    return "CV";
  }
  if (norm.includes("speaker") || norm.includes("bluetooth speaker")) {
    return "SP";
  }
  if (norm.includes("battery")) {
    return "BT";
  }

  // Fallback heuristic:
  const words = categoryName.trim().split(/[\s\-_/]+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words[0].toUpperCase();
}
