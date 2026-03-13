export function isValidationError(e) {
  return e?.name === "ValidationError";
}

export function readEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error("Ungültige E-Mail-Adresse");
  return s;
}

export function readPassword(value, label = "Passwort") {
  const s = String(value || "");
  // Erhöhte Sicherheit: Mind. 8 Zeichen, 1 Großbuchstabe, 1 Zahl
  if (s.length < 8 || !/[A-Z]/.test(s) || !/[0-9]/.test(s)) {
    throw new Error(`${label} muss mindestens 8 Zeichen lang sein und einen Großbuchstaben sowie eine Zahl enthalten.`);
  }
  return s;
}

export function readRequiredString(value, label, { max = 255 } = {}) {
  const s = String(value || "").trim();
  if (!s) throw new Error(`${label} ist erforderlich`);
  if (s.length > max) throw new Error(`${label} ist zu lang (max ${max})`);
  return s;
}

export function readOptionalString(value, label, { max = 255, empty = "" } = {}) {
  const s = String(value || "").trim();
  if (!s) return empty;
  if (s.length > max) throw new Error(`${label} ist zu lang (max ${max})`);
  return s;
}

export function readRequiredHtml(value, label = "HTML") {
  const s = String(value || "").trim();
  if (!s) throw new Error(`${label} ist erforderlich`);
  return s;
}

export function readOptionalHtml(value, label = "HTML") {
  return String(value || "").trim();
}

export function readOptionalUrl(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  try { new URL(s); return s; } catch { throw new Error("Ungültige URL"); }
}

export function readOptionalNumber(value, label, { min, max, integer } = {}) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (isNaN(n)) throw new Error(`${label} muss eine Zahl sein`);
  if (min !== undefined && n < min) throw new Error(`${label} muss mindestens ${min} sein`);
  if (max !== undefined && n > max) throw new Error(`${label} darf maximal ${max} sein`);
  if (integer && !Number.isInteger(n)) throw new Error(`${label} muss eine Ganzzahl sein`);
  return n;
}

export function readId(value, label = "ID") {
  const n = Number(value);
  if (isNaN(n) || n < 1 || !Number.isInteger(n)) throw new Error(`Ungültige ${label}`);
  return n;
}
