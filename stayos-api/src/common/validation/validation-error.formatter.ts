import { ValidationError } from 'class-validator';
import { ApiErrorDetail } from '../errors/api-error.interface';

const sensitiveFieldPattern = /(password|secret|token|key|authorization)/i;

export const formatValidationErrors = (errors: ValidationError[]): ApiErrorDetail[] =>
  flattenValidationErrors(errors);

const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath?: string,
): ApiErrorDetail[] =>
  errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownErrors = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
      ...(isSafeRejectedValue(field, error.value) ? { rejectedValue: error.value } : {}),
    }));

    return [...ownErrors, ...flattenValidationErrors(error.children ?? [], field)];
  });

const isSafeRejectedValue = (field: string, value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (sensitiveFieldPattern.test(field)) {
    return false;
  }

  return ['string', 'number', 'boolean'].includes(typeof value);
};
