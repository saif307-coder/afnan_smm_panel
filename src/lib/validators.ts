/**
 * Validation helpers for Phase 2 Admin API routes.
 * Centralizes input validation logic to keep route handlers clean.
 */

/** Valid internal metric types that can be mapped to provider services */
export const VALID_METRIC_TYPES = [
  'VIEWS',
  'LIKES',
  'SAVES',
  'COMMENTS',
  'SHARES',
  'REPOSTS',
  'FOLLOWS',
  'FOLLOWERS',
] as const;

export type MetricType = (typeof VALID_METRIC_TYPES)[number];

export function isValidMetricType(value: unknown): value is MetricType {
  return typeof value === 'string' && VALID_METRIC_TYPES.includes(value as MetricType);
}

/** Validate that a value is a finite number within an optional range */
export function isValidNumber(
  value: unknown,
  options?: { min?: number; max?: number }
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (options?.min !== undefined && value < options.min) return false;
  if (options?.max !== undefined && value > options.max) return false;
  return true;
}

/** Validate that a value is a non-empty trimmed string */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate a percentage value (0 to 100) */
export function isValidPercentage(value: unknown): value is number {
  return isValidNumber(value, { min: 0, max: 100 });
}

/** Validate a ratio value (0 to 1) */
export function isValidRatio(value: unknown): value is number {
  return isValidNumber(value, { min: 0, max: 1 });
}

/** Validate a URL string (basic check) */
export function isValidUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Build a structured error response body */
export function validationError(field: string, message: string) {
  return { field, message };
}

export interface ValidationError {
  field: string;
  message: string;
}
