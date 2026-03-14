export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isValidationError(e) {
  return e instanceof ValidationError || e?.name === "ValidationError";
}

export function readEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ValidationError("Ungültige E-Mail-Adresse");
  return s;
}

export function readPassword(value, label = "Passwort") {
  const s = String(value || "");
  if (s.length < 8 || !/[A-Z]/.test(s) || !/[0-9]/.test(s)) {
    throw new ValidationError(`${label} muss mindestens 8 Zeichen lang sein und einen Großbuchstaben sowie eine Zahl enthalten.`);
  }
  return s;
}

export function readRequiredString(value, label, { max = 255 } = {}) {
  const s = String(value || "").trim();
  if (!s) throw new ValidationError(`${label} ist erforderlich`);
  if (s.length > max) throw new ValidationError(`${label} ist zu lang (max ${max})`);
  return s;
}

export function readOptionalString(value, label, { max = 255, empty = "" } = {}) {
  const s = String(value || "").trim();
  if (!s) return empty;
  if (s.length > max) throw new ValidationError(`${label} ist zu lang (max ${max})`);
  return s;
}

function assertHtmlMaxLength(value, label, max) {
  if (max === undefined || max === null) return;
  const limit = Number(max);
  if (!Number.isFinite(limit) || limit <= 0) return;
  if (value.length > limit) {
    throw new ValidationError(`${label} ist zu lang (max ${limit} Zeichen)`);
  }
}

export function readRequiredHtml(value, label = "HTML", { max } = {}) {
  const s = String(value || "").trim();
  if (!s) throw new ValidationError(`${label} ist erforderlich`);
  assertHtmlMaxLength(s, label, max);
  return s;
}

export function readOptionalHtml(value, label = "HTML", { max } = {}) {
  const s = String(value || "").trim();
  assertHtmlMaxLength(s, label, max);
  return s;
}

export function readOptionalUrl(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  try {
    new URL(s);
    return s;
  } catch {
    throw new ValidationError("Ungültige URL");
  }
}

export function readOptionalNumber(value, label, { min, max, integer } = {}) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) throw new ValidationError(`${label} muss eine Zahl sein`);
  if (min !== undefined && n < min) throw new ValidationError(`${label} muss mindestens ${min} sein`);
  if (max !== undefined && n > max) throw new ValidationError(`${label} darf maximal ${max} sein`);
  if (integer && !Number.isInteger(n)) throw new ValidationError(`${label} muss eine Ganzzahl sein`);
  return n;
}

export function readOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

export function readOptionalEnum(value, allowedValues, label, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (allowedValues.includes(value)) return value;
  throw new ValidationError(`Ungültiger Wert für ${label}. Erlaubt: ${allowedValues.join(", ")}`);
}

export function readOptionalIsoDate(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`Ungültiges Datum für ${label}`);
  return d.toISOString();
}

export function readId(value, label = "ID") {
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || !Number.isInteger(n)) throw new ValidationError(`Ungültige ${label}`);
  return n;
}
