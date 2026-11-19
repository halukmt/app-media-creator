/**
 * Groups server validation messages (`"<path>: <message>"`) by the form field that caused them,
 * so the UI can show each error next to its field. Messages without a known field end up in `other`.
 */

export type ProjectField =
  | 'name'
  | 'locales'
  | 'sourceLocale'
  | 'targets.apple'
  | 'targets.google'
  | 'targets.web'
  | 'claims.allowed'
  | 'claims.forbidden'
  | `environments.${number}.${EnvironmentField}`;

type EnvironmentField = 'id' | 'badge' | 'color' | 'style';
const ENVIRONMENT_FIELDS: readonly EnvironmentField[] = ['id', 'badge', 'color', 'style'];
/** Matches the server limit; error paths of further entries end up in `other`. */
const MAX_ENVIRONMENT_ERRORS = 5;

const FIELDS: readonly ProjectField[] = [
  'name',
  'locales',
  'sourceLocale',
  'targets.apple',
  'targets.google',
  'targets.web',
  'claims.allowed',
  'claims.forbidden',
  ...Array.from({ length: MAX_ENVIRONMENT_ERRORS }, (_, index) => ENVIRONMENT_FIELDS.map((field) => `environments.${index}.${field}` as const)).flat(),
];

export interface GroupedErrors {
  fields: Partial<Record<ProjectField, string[]>>;
  other: string[];
}

export function groupProjectErrors(messages: readonly string[]): GroupedErrors {
  const grouped: GroupedErrors = { fields: {}, other: [] };
  for (const message of messages) {
    const separator = message.indexOf(': ');
    const path = separator > 0 ? message.slice(0, separator) : '';
    const text = separator > 0 ? message.slice(separator + 2) : message;
    const field = FIELDS.find((candidate) => path === candidate || path.startsWith(`${candidate}.`));
    if (field) (grouped.fields[field] ??= []).push(text);
    else grouped.other.push(message);
  }
  return grouped;
}

/** Joined message of one field, or undefined when it has none. */
export function fieldError(grouped: GroupedErrors, field: ProjectField): string | undefined {
  const list = grouped.fields[field];
  return list && list.length > 0 ? list.join(' ') : undefined;
}
