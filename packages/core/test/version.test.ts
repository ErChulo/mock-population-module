import { GENERATOR_VERSION } from "../src/version";

describe("GENERATOR_VERSION", () => {
  it("is 1.0.0", () => {
    expect(GENERATOR_VERSION).toBe("1.0.0");
  });
});
