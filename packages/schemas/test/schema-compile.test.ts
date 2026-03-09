import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const schemaFiles = [
  "FieldCatalog.schema.json",
  "NonEmptyFields.schema.json",
  "GeneratorConfig.schema.json",
  "GeneratedPopulation.schema.json"
] as const;

describe("schema compilation", () => {
  it("compiles all JSON Schemas with AJV", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);

    for (const fileName of schemaFiles) {
      const schemaPath = path.resolve(__dirname, "..", fileName);
      const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
      const validate = ajv.compile(schema);
      expect(typeof validate).toBe("function");
    }
  });
});
