import { createHash } from "node:crypto";
import { generateCleanPopulation, populationToCsv, type FieldCatalog, type GeneratorConfig, type NonEmptyFields } from "../src";

const fieldNames = [
  "Cust_ID",
  "ID",
  "RETSTAT",
  "DOB",
  "DOH",
  "DOP",
  "DOTE",
  "DOR",
  "DOD",
  "MSTAT",
  "SFNAME",
  "SLNAME",
  "SDOB",
  "SBCD",
  "LEV_MB_ARD",
  "PA_AMB",
  "LS_EST_AMT",
  "LS_EST_DATE",
  "FORM_CODE_ARD"
];

const fieldCatalog: FieldCatalog = {
  fields: fieldNames.map((name) => ({ name }))
};

const nonEmptyFields: NonEmptyFields = {
  fields: [...fieldNames]
};

const config: GeneratorConfig = {
  seed: 12345,
  rowCount: 80,
  scenarioMix: {
    participant_in_pay: 0.2,
    participant_deferred_vested: 0.15,
    participant_active_vested: 0.15,
    participant_not_vested: 0.1,
    beneficiary_in_pay: 0.1,
    alternate_payee_in_pay: 0.1,
    de_minimis_lump_sum: 0.1,
    excluded: 0.1
  },
  planTerminationDate: "2025-12-31",
  requiredBeginningAge: 73,
  normalRetirementAge: 65,
  planYearStartMonthDay: "01-01"
};

describe("generateCleanPopulation", () => {
  it("is deterministic for same inputs and seed including CSV bytes and SHA256", () => {
    const firstRecords = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const secondRecords = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const firstCsv = populationToCsv(firstRecords, nonEmptyFields.fields);
    const secondCsv = populationToCsv(secondRecords, nonEmptyFields.fields);
    const firstHash = sha256(firstCsv);
    const secondHash = sha256(secondCsv);

    expect(firstRecords).toEqual(secondRecords);
    expect(firstCsv).toBe(secondCsv);
    expect(firstHash).toBe(secondHash);
  });

  it("enforces clean invariants", () => {
    const records = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);

    for (const record of records) {
      if (record.DOB && record.DOH) {
        expect(record.DOB < record.DOH).toBe(true);
      }
      if (record.DOH && record.DOP) {
        expect(record.DOH <= record.DOP).toBe(true);
      }
      if (record.DOP && record.DOTE) {
        expect(record.DOP <= record.DOTE).toBe(true);
      }
      if (record.ID === "1" && record.RETSTAT === "1") {
        expect(record.DOR).not.toBe("");
      }
      if (record.ID === "2") {
        expect(record.SBCD).not.toBe("");
        expect(record.DOR).toBe("");
      }
      if (record.DOD && record.DOR) {
        expect(record.DOR < record.DOD).toBe(true);
      }
      if (record.MSTAT === "M") {
        expect(record.SFNAME).not.toBe("");
        expect(record.SLNAME).not.toBe("");
        expect(record.SDOB).not.toBe("");
      }
      expect(record.ID === "" || ["1", "2", "4"].includes(record.ID)).toBe(true);
      expect(record.RETSTAT === "" || ["1", "2", "3", "4", "5"].includes(record.RETSTAT)).toBe(true);
    }
  });
});

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
