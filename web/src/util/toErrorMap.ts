import { FieldError } from "../generated/graphql";

export const toErrorMap = (errors: FieldError[]) => {
  const map: Record<string, string> = {};
  errors.forEach((error) => {
    map[error.field] = error.message;
  });
  return map;
};
