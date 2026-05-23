import type { FormInstance } from "antd/es/form";
import type { NamePath } from "rc-field-form/lib/interface";

type ValidationErrorField = {
  name: NamePath;
  errors?: string[];
};

type ValidationErrorLike = {
  errorFields?: ValidationErrorField[];
};

const toNamePathArray = (name: NamePath): Array<string | number> =>
  Array.isArray(name) ? name : [name];

const toTitleCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeSegment = (segment: string | number): string => {
  if (typeof segment === "number") return `#${segment + 1}`;
  return toTitleCase(String(segment));
};

export const isAntdFormValidationError = (error: unknown): error is ValidationErrorLike => {
  if (!error || typeof error !== "object") return false;
  return Array.isArray((error as ValidationErrorLike).errorFields);
};

export const formatValidationFieldName = (name: NamePath): string => {
  const parts = toNamePathArray(name)
    .map((segment) => normalizeSegment(segment))
    .filter(Boolean);

  return parts.join(" → ");
};

export const getValidationMessage = (
  error: unknown,
  options?: {
    prefix?: string;
    fallback?: string;
    maxFields?: number;
  },
): string => {
  const fallback = options?.fallback ?? "Please complete all required fields.";
  if (!isAntdFormValidationError(error) || !error.errorFields?.length) return fallback;

  const maxFields = options?.maxFields ?? 3;
  const fieldNames = error.errorFields
    .map((field) => formatValidationFieldName(field.name))
    .filter(Boolean);

  if (!fieldNames.length) return fallback;

  const visibleFields = fieldNames.slice(0, maxFields);
  const remainingCount = fieldNames.length - visibleFields.length;
  const suffix = remainingCount > 0 ? `, and ${remainingCount} more.` : ".";
  const prefix = options?.prefix?.trim();

  return `${prefix ? `${prefix}: ` : "Please complete required field: "}${visibleFields.join(", ")}${suffix}`;
};

export const focusFirstInvalidField = <T extends object>(
  form: FormInstance<T>,
  error: unknown,
) => {
  if (!isAntdFormValidationError(error) || !error.errorFields?.length) return;
  form.scrollToField(error.errorFields[0].name, {
    block: "center",
    behavior: "smooth",
  });
};
