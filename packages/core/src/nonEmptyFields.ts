import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import type { FieldCatalog, PathOrBytes } from "./ddCsv";

export interface NonEmptyOrderingRules {
  preserveInputOrder?: boolean;
  customOrder?: string[];
}

export interface NonEmptyFields {
  fields: string[];
  orderingRules?: NonEmptyOrderingRules;
}

export type NonEmptyInput = NonEmptyFields | PathOrBytes;

export function validateNonEmptyFields(
  nonEmptyInput: NonEmptyInput,
  fieldCatalog: FieldCatalog,
  schemaPath: string = resolveNonEmptySchemaPath()
): NonEmptyFields {
  const nonEmptyFields = loadNonEmptyFields(nonEmptyInput);
  validateAgainstSchema(nonEmptyFields, schemaPath);
  validateBusinessRules(nonEmptyFields, fieldCatalog);
  return nonEmptyFields;
}

function validateAgainstSchema(nonEmptyFields: NonEmptyFields, schemaPath: string): void {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = ajv.compile<NonEmptyFields>(schema);
  const valid = validate(nonEmptyFields);
  if (!valid) {
    throw new Error(formatAjvErrors(validate.errors ?? []));
  }
}

function validateBusinessRules(nonEmptyFields: NonEmptyFields, fieldCatalog: FieldCatalog): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const field of nonEmptyFields.fields) {
    if (seen.has(field)) {
      duplicates.push(field);
    }
    seen.add(field);
  }
  if (duplicates.length > 0) {
    throw new Error(`NonEmptyFields validation failed: duplicate fields: ${[...new Set(duplicates)].join(", ")}`);
  }

  const knownFields = new Set(fieldCatalog.fields.map((field) => field.name));
  const unknownFields = nonEmptyFields.fields.filter((field) => !knownFields.has(field));
  if (unknownFields.length > 0) {
    throw new Error(`NonEmptyFields validation failed: unknown fields: ${[...new Set(unknownFields)].join(", ")}`);
  }
}

function loadNonEmptyFields(nonEmptyInput: NonEmptyInput): NonEmptyFields {
  if (typeof nonEmptyInput === "string") {
    const payload = readFileSync(nonEmptyInput, "utf8");
    return JSON.parse(payload) as NonEmptyFields;
  }
  if (nonEmptyInput instanceof Uint8Array) {
    return JSON.parse(new TextDecoder("utf-8").decode(nonEmptyInput)) as NonEmptyFields;
  }
  return nonEmptyInput;
}

function resolveNonEmptySchemaPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "packages/schemas/NonEmptyFields.schema.json"),
    path.resolve(__dirname, "../../schemas/NonEmptyFields.schema.json"),
    path.resolve(__dirname, "../../../schemas/NonEmptyFields.schema.json")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Unable to locate NonEmptyFields.schema.json");
}

function formatAjvErrors(errors: ErrorObject[]): string {
  const details = errors.map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`);
  return `NonEmptyFields schema validation failed: ${details.join("; ")}`;
}
