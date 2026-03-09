import { createHash } from "node:crypto";
import {
  buildTextReport,
  generateCleanPopulation,
  generateDirtyPopulation,
  populationToSqliteBuffer,
  type FieldCatalog,
  type GeneratorConfig,
  type NonEmptyFields
} from "../src";

const fields = ["Cust_ID", "ID", "RETSTAT", "DOB", "DOH", "DOP", "DOTE", "DOR", "MSTAT", "SDOB", "FORM_CODE_ARD"];
const fieldCatalog: FieldCatalog = { fields: fields.map((name) => ({ name })) };
const nonEmptyFields: NonEmptyFields = { fields: [...fields] };
const config: GeneratorConfig = {
  seed: 7001,
  rowCount: 20,
  scenarioMix: { participant_in_pay: 1 },
  planTerminationDate: "2026-12-31",
  requiredBeginningAge: 73,
  normalRetirementAge: 65,
  planYearStartMonthDay: "01-01",
  dirtyInjection: {
    rates: {
      married_missing_sdob: 0.2,
      payable_missing_form_code_ard: 0.3
    }
  }
};

describe("sqlite and report exports", () => {
  it("produces deterministic sqlite bytes", async () => {
    const clean = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const first = await populationToSqliteBuffer(clean, nonEmptyFields.fields, "population_clean");
    const second = await populationToSqliteBuffer(clean, nonEmptyFields.fields, "population_clean");
    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
    expect(sha256(first)).toBe(sha256(second));
  });

  it("produces deterministic text report", () => {
    const clean = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const dirty = generateDirtyPopulation(clean, nonEmptyFields, config);
    const first = buildTextReport({
      config,
      cleanRecords: clean,
      dirtyRecords: dirty.records,
      dirtyMetadata: dirty.metadata
    });
    const second = buildTextReport({
      config,
      cleanRecords: clean,
      dirtyRecords: dirty.records,
      dirtyMetadata: dirty.metadata
    });
    expect(first).toBe(second);
    expect(first).toContain("CaseWorkbench Mock Population Summary");
    expect(first).toContain("Generator Version:");
  });
});

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
