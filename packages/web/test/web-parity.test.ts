import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildMetadata,
  generateCleanPopulation,
  generateDirtyPopulation,
  parseDDCsv,
  populationToCsv,
  validateNonEmptyFields,
  type GeneratorConfig
} from "@caseworkbench/core";
import { generateArtifactsBrowser } from "../src/browserPipeline";

describe("web parity", () => {
  it("matches CLI-equivalent outputs byte-for-byte for same inputs and seed", async () => {
    const root = path.resolve(__dirname, "../../..");
    const ddPath = path.join(root, "packages/examples/dd-subset.csv");
    const nonemptyPath = path.join(root, "packages/examples/nonempty.valid.json");
    const configPath = path.join(root, "packages/examples/config.json");

    const ddText = readFileSync(ddPath, "utf8");
    const nonemptyText = readFileSync(nonemptyPath, "utf8");
    const configText = readFileSync(configPath, "utf8");
    const seed = 98765;

    const browser = await generateArtifactsBrowser(ddText, nonemptyText, configText, seed);
    const cliLike = buildCliLikeArtifacts(ddText, nonemptyText, configText, seed);

    expect(browser.cleanCsv).toBe(cliLike.cleanCsv);
    expect(browser.dirtyCsv).toBe(cliLike.dirtyCsv);
    expect(browser.metadataJson).toBe(cliLike.metadataJson);
  });
});

function buildCliLikeArtifacts(ddText: string, nonemptyText: string, configText: string, seed: number): {
  cleanCsv: string;
  dirtyCsv: string;
  metadataJson: string;
} {
  const config = { ...(JSON.parse(configText) as GeneratorConfig), seed };
  const fieldCatalog = parseDDCsv(new TextEncoder().encode(ddText));
  const nonEmpty = validateNonEmptyFields(new TextEncoder().encode(nonemptyText), fieldCatalog);
  const cleanRecords = generateCleanPopulation(fieldCatalog, nonEmpty, config);
  const dirty = generateDirtyPopulation(cleanRecords, nonEmpty, config);
  const cleanCsv = populationToCsv(cleanRecords, nonEmpty.fields);
  const dirtyCsv = populationToCsv(dirty.records, nonEmpty.fields);
  const metadata = buildMetadata({
    config,
    cleanRecords,
    dirtyRecords: dirty.records,
    dirtyMetadata: dirty.metadata,
    inputArtifacts: {
      "DD.csv": ddText,
      "nonempty.json": nonemptyText,
      "config.json": configText
    },
    outputArtifacts: {
      "population.clean.csv": cleanCsv,
      "population.dirty.csv": dirtyCsv
    }
  });
  return {
    cleanCsv,
    dirtyCsv,
    metadataJson: `${JSON.stringify(metadata, null, 2)}\n`
  };
}
