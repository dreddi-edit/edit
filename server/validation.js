export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = "ValidationError"
  }
}

function asTrimmedString(value, field) {
  if (typeof value !== "string") throw new ValidationError(`${field} ungültig`)
  return value.trim()
}

export function readEmail(value, field = "Email") {
  const email = asTrimmedString(value, field).toLowerCase()
  if (!email) throw new ValidationError(`${field} erforderlich`)
  if (email.length > 320) throw new ValidationError(`${field} zu lang`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError(`${field} ungültig`)
  return email
}

export function readPassword(value, field = "Passwort", minLength = 8) {
  if (typeof value !== "string") throw new ValidationError(`${field} ungültig`)
  const password = value
  if (!password.trim()) throw new ValidationError(`${field} erforderlich`)
  if (password.length < minLength) throw new ValidationError(`${field} min. ${minLength} Zeichen`)
  if (!/[A-Z]/.test(password)) throw new ValidationError(`${field} benötigt einen Großbuchstaben`)
  if (!/[a-z]/.test(password)) throw new ValidationError(`${field} benötigt einen Kleinbuchstaben`)
  if (!/[0-9]/.test(password)) throw new ValidationError(`${field} benötigt eine Zahl`)
  if (password.length > 128) throw new ValidationError(`${field} zu lang`)
  return password
}

export function readRequiredString(value, field, { max = 200 } = {}) {
  const text = asTrimmedString(value, field)
  if (!text) throw new ValidationError(`${field} erforderlich`)
  if (text.length > max) throw new ValidationError(`${field} zu lang`)
  return text
}

export function readOptionalString(value, field, { max = 500, empty = "" } = {}) {
  if (value == null || value === "") return empty
  const text = asTrimmedString(value, field)
  if (text.length > max) throw new ValidationError(`${field} zu lang`)
  return text
}

export function readOptionalHtml(value, field = "HTML", { max = 2_000_000 } = {}) {
  if (value == null || value === "") return ""
  if (typeof value !== "string") throw new ValidationError(`${field} ungültig`)
  if (value.length > max) throw new ValidationError(`${field} zu groß`)
  return value
}

export function readRequiredHtml(value, field = "HTML", { max = 2_000_000 } = {}) {
  if (typeof value !== "string") throw new ValidationError(`${field} ungültig`)
  if (!value.trim()) throw new ValidationError(`${field} erforderlich`)
  if (value.length > max) throw new ValidationError(`${field} zu groß`)
  return value
}

export function readOptionalUrl(value, field = "URL") {
  if (value == null || value === "") return ""
  const url = asTrimmedString(value, field)
  if (url.length > 2048) throw new ValidationError(`${field} zu lang`)
  return url
}

export function readId(value, field = "ID") {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) throw new ValidationError(`${field} ungültig`)
  return num
}

export function readOptionalBoolean(value, field = "Wert") {
  if (value === undefined) return undefined
  if (typeof value === "boolean") return value ? 1 : 0
  if (value === 1 || value === "1" || value === "true") return 1
  if (value === 0 || value === "0" || value === "false") return 0
  throw new ValidationError(`${field} ungültig`)
}

export function readOptionalNumber(value, field = "Wert", { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === undefined || value === null || value === "") return undefined
  const num = Number(value)
  if (!Number.isFinite(num)) throw new ValidationError(`${field} ungültig`)
  if (integer && !Number.isInteger(num)) throw new ValidationError(`${field} ungültig`)
  if (num < min || num > max) throw new ValidationError(`${field} ungültig`)
  return num
}

export function readOptionalEnum(value, allowed, field = "Wert", empty = undefined) {
  if (value === undefined || value === null || value === "") return empty
  const normalized = asTrimmedString(String(value).toLowerCase(), field)
  if (!allowed.includes(normalized)) throw new ValidationError(`${field} ungültig`)
  return normalized
}

export function readOptionalIsoDate(value, field = "Datum") {
  if (value === undefined || value === null || value === "") return ""
  const text = asTrimmedString(value, field)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} ungültig`)
  return date.toISOString()
}

export function isValidationError(error) {
  return error instanceof ValidationError
}
