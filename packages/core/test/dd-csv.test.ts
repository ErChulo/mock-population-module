import { readFileSync } from "node:fs";
import path from "node:path";
import { inferType, parseDDCsv } from "../src/ddCsv";

describe("parseDDCsv", () => {
  const ddPath = path.resolve(__dirname, "../../examples/dd-subset.csv");

  it("parses deterministic FieldCatalog output from DD.csv path", () => {
    const first = parseDDCsv(ddPath);
    const second = parseDDCsv(ddPath);
    expect(first).toEqual(second);
    expect(first).toEqual({
      fields: [
        { name: "Cust_ID", inferredType: "string", description: "Synthetic participant token" },
        { name: "DOB", inferredType: "date", description: "Date of birth" },
        { name: "DOH", inferredType: "date", description: "Date of hire" },
        { name: "PA_AMB", inferredType: "number", description: "Payable annual amount" },
        { name: "MSTAT", inferredType: "string", description: "Marital status indicator" },
        { name: "BEN_CNT", inferredType: "integer", description: "Beneficiary count" }
      ]
    });
  });

  it("parses deterministic FieldCatalog output from bytes", () => {
    const bytes = readFileSync(ddPath);
    expect(parseDDCsv(bytes)).toEqual(parseDDCsv(bytes));
  });
});

describe("inferType", () => {
  it("maps explicit type names first", () => {
    expect(inferType("PA_AMB", "decimal", "Payable annual amount")).toBe("number");
    expect(inferType("SOME_FIELD", "int", "Arbitrary")).toBe("integer");
  });

  it("falls back to name/description heuristics", () => {
    expect(inferType("DOB", "", "Date of birth")).toBe("date");
    expect(inferType("BEN_CNT", "", "Beneficiary count")).toBe("integer");
  });
});
