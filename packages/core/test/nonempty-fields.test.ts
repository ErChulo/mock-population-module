import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDDCsv, validateNonEmptyFields } from "../src";

describe("validateNonEmptyFields", () => {
  const ddPath = path.resolve(__dirname, "../../examples/dd-subset.csv");
  const catalog = parseDDCsv(ddPath);

  it("passes for valid nonempty.json", () => {
    const validPath = path.resolve(__dirname, "../../examples/nonempty.valid.json");
    const result = validateNonEmptyFields(validPath, catalog);
    expect(result.fields).toEqual(["Cust_ID", "DOB", "PA_AMB"]);
    expect(result.orderingRules?.preserveInputOrder).toBe(true);
  });

  it("fails for unknown fields", () => {
    const invalidPath = path.resolve(__dirname, "../../examples/nonempty.unknown-field.json");
    expect(() => validateNonEmptyFields(invalidPath, catalog)).toThrow("unknown fields: NOT_IN_DD");
  });

  it("fails for duplicates", () => {
    const invalidPath = path.resolve(__dirname, "../../examples/nonempty.duplicate-field.json");
    expect(() => validateNonEmptyFields(invalidPath, catalog)).toThrow();
  });

  it("supports validating JSON bytes", () => {
    const validPath = path.resolve(__dirname, "../../examples/nonempty.valid.json");
    const bytes = readFileSync(validPath);
    const result = validateNonEmptyFields(bytes, catalog);
    expect(result.fields).toEqual(["Cust_ID", "DOB", "PA_AMB"]);
  });
});
