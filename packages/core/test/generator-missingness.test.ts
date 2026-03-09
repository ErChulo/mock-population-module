import { generateCleanPopulation, type FieldCatalog, type GeneratorConfig, type NonEmptyFields } from "../src";

const fields = ["Cust_ID", "ID", "RETSTAT", "DOB", "DOH", "DOP", "DOTE", "DOR", "FNAME", "LNAME", "MSTAT"];
const fieldCatalog: FieldCatalog = { fields: fields.map((name) => ({ name })) };
const nonEmptyFields: NonEmptyFields = { fields: [...fields] };

describe("missingnessModel", () => {
  it("applies deterministic missingness while preserving required fields", () => {
    const config: GeneratorConfig = {
      seed: 8080,
      rowCount: 30,
      scenarioMix: { participant_in_pay: 1 },
      planTerminationDate: "2026-12-31",
      requiredBeginningAge: 73,
      normalRetirementAge: 65,
      planYearStartMonthDay: "01-01",
      missingnessModel: {
        defaultRate: 1,
        requiredFields: ["DOB", "DOH", "DOP", "DOTE", "DOR"]
      }
    };

    const records = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    for (const record of records) {
      expect(record.Cust_ID).not.toBe("");
      expect(record.ID).toBe("1");
      expect(record.RETSTAT).toBe("1");
      expect(record.DOB).not.toBe("");
      expect(record.DOH).not.toBe("");
      expect(record.DOP).not.toBe("");
      expect(record.DOTE).not.toBe("");
      expect(record.DOR).not.toBe("");
      expect(record.FNAME).toBe("");
      expect(record.LNAME).toBe("");
      expect(record.MSTAT).toBe("");
    }
  });

  it("supports field-level missingness rates", () => {
    const config: GeneratorConfig = {
      seed: 9090,
      rowCount: 25,
      scenarioMix: { participant_in_pay: 1 },
      planTerminationDate: "2026-12-31",
      requiredBeginningAge: 73,
      normalRetirementAge: 65,
      planYearStartMonthDay: "01-01",
      missingnessModel: {
        defaultRate: 0,
        fieldRates: {
          FNAME: 1
        },
        requiredFields: ["DOB", "DOH", "DOP", "DOTE", "DOR"]
      }
    };

    const records = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    expect(records.every((record) => record.FNAME === "")).toBe(true);
    expect(records.some((record) => record.LNAME !== "")).toBe(true);
  });
});
