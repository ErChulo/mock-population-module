import {
  generateCleanPopulation,
  generateDirtyPopulation,
  type DirtyIssueType,
  type FieldCatalog,
  type GeneratorConfig,
  type NonEmptyFields
} from "../src";

const fields = [
  "Cust_ID",
  "ID",
  "RETSTAT",
  "DOB",
  "DOH",
  "DOP",
  "DOTE",
  "DOR",
  "MSTAT",
  "SDOB",
  "SBCD",
  "FORM_CODE_ARD"
];

const fieldCatalog: FieldCatalog = { fields: fields.map((name) => ({ name })) };
const nonEmptyFields: NonEmptyFields = { fields: [...fields] };

const config: GeneratorConfig = {
  seed: 20260308,
  rowCount: 120,
  scenarioMix: {
    participant_in_pay: 0.2,
    participant_deferred_vested: 0.2,
    participant_active_vested: 0.15,
    participant_not_vested: 0.1,
    beneficiary_in_pay: 0.15,
    alternate_payee_in_pay: 0.1,
    de_minimis_lump_sum: 0.05,
    excluded: 0.05
  },
  planTerminationDate: "2026-12-31",
  requiredBeginningAge: 73,
  normalRetirementAge: 65,
  planYearStartMonthDay: "01-01",
  dirtyInjection: {
    enabledIssueTypes: [
      "married_missing_sdob",
      "dor_earlier_than_dote",
      "beneficiary_has_dor",
      "payable_missing_form_code_ard"
    ],
    rates: {
      married_missing_sdob: 0.2,
      dor_earlier_than_dote: 0.1,
      beneficiary_has_dor: 0.5,
      payable_missing_form_code_ard: 0.25
    },
    tolerance: 0
  }
};

describe("generateDirtyPopulation", () => {
  it("injects configured issue counts within tolerance and returns metadata", () => {
    const clean = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const result = generateDirtyPopulation(clean, nonEmptyFields, config);
    const tolerance = config.dirtyInjection?.tolerance ?? 0;

    for (const summary of result.metadata.summaries) {
      const delta = Math.abs(summary.actualCount - summary.targetCount);
      expect(delta).toBeLessThanOrEqual(tolerance);
      expect(result.metadata.issueCounts[summary.issueType]).toBe(summary.actualCount);
      expect(summary.affectedCustIds.length).toBe(summary.actualCount);
    }
  });

  it("injects each enabled issue when prerequisites exist", () => {
    const clean = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const dirty = generateDirtyPopulation(clean, nonEmptyFields, config).records;
    const issueChecks: Record<DirtyIssueType, boolean> = {
      married_missing_sdob: dirty.some((record) => record.MSTAT === "M" && record.SDOB === ""),
      dor_earlier_than_dote: dirty.some((record) => record.DOR && record.DOTE && record.DOR < record.DOTE),
      beneficiary_has_dor: dirty.some((record) => record.ID === "2" && record.DOR !== ""),
      payable_missing_form_code_ard: dirty.some((record) => record.RETSTAT === "1" && record.FORM_CODE_ARD === "")
    };

    expect(issueChecks.married_missing_sdob).toBe(true);
    expect(issueChecks.dor_earlier_than_dote).toBe(true);
    expect(issueChecks.beneficiary_has_dor).toBe(true);
    expect(issueChecks.payable_missing_form_code_ard).toBe(true);
  });
});
