import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildMetadata,
  generateCleanPopulation,
  generateDirtyPopulation,
  hashContent,
  metadataToJson,
  populationToCsv,
  writeMetadataJson,
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
  "FORM_CODE_ARD",
  "LS_EST_AMT"
];

const fieldCatalog: FieldCatalog = { fields: fields.map((name) => ({ name })) };
const nonEmptyFields: NonEmptyFields = { fields: [...fields] };

const config: GeneratorConfig = {
  seed: 424242,
  rowCount: 60,
  scenarioMix: {
    participant_in_pay: 0.2,
    participant_deferred_vested: 0.2,
    participant_active_vested: 0.2,
    beneficiary_in_pay: 0.15,
    alternate_payee_in_pay: 0.1,
    de_minimis_lump_sum: 0.1,
    excluded: 0.05
  },
  planTerminationDate: "2026-12-31",
  requiredBeginningAge: 73,
  normalRetirementAge: 65,
  planYearStartMonthDay: "01-01",
  dirtyInjection: {
    rates: {
      married_missing_sdob: 0.1,
      dor_earlier_than_dote: 0.1,
      beneficiary_has_dor: 0.25,
      payable_missing_form_code_ard: 0.2
    }
  }
};

describe("metadata", () => {
  it("is deterministic and hashes match actual artifacts", () => {
    const cleanRecords = generateCleanPopulation(fieldCatalog, nonEmptyFields, config);
    const dirty = generateDirtyPopulation(cleanRecords, nonEmptyFields, config);
    const cleanCsv = populationToCsv(cleanRecords, nonEmptyFields.fields);
    const dirtyCsv = populationToCsv(dirty.records, nonEmptyFields.fields);

    const inputArtifacts = {
      "DD.csv": "FieldName,Type,Description\nCust_ID,varchar,Synthetic token\n",
      "nonempty.json": JSON.stringify(nonEmptyFields),
      "config.json": JSON.stringify(config)
    };
    const outputArtifacts = {
      "population.clean.csv": cleanCsv,
      "population.dirty.csv": dirtyCsv
    };

    const first = buildMetadata({
      config,
      cleanRecords,
      dirtyRecords: dirty.records,
      dirtyMetadata: dirty.metadata,
      inputArtifacts,
      outputArtifacts
    });
    const second = buildMetadata({
      config,
      cleanRecords,
      dirtyRecords: dirty.records,
      dirtyMetadata: dirty.metadata,
      inputArtifacts,
      outputArtifacts
    });

    const firstJson = metadataToJson(first);
    const secondJson = metadataToJson(second);

    expect(first).toEqual(second);
    expect(firstJson).toBe(secondJson);
    expect(first.seed).toBe(config.seed);
    expect(first.GENERATOR_VERSION).toBeDefined();
    expect(first.outputFileHashes["population.clean.csv"]).toBe(hashContent(cleanCsv));
    expect(first.outputFileHashes["population.dirty.csv"]).toBe(hashContent(dirtyCsv));

    const tempDir = mkdtempSync(path.join(tmpdir(), "mockgen-metadata-"));
    const metadataPath = path.join(tempDir, "metadata.json");
    writeMetadataJson(first, metadataPath);
    const written = readFileSync(metadataPath, "utf8");
    expect(written).toBe(firstJson);
  });
});
