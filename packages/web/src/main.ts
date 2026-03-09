import JSZip from "jszip";
import "./style.css";
import { generateArtifactsBrowser } from "./browserPipeline";

const form = document.querySelector<HTMLFormElement>("#generator-form");
const status = document.querySelector<HTMLElement>("#status");
const ddInput = document.querySelector<HTMLInputElement>("#dd-file");
const nonemptyInput = document.querySelector<HTMLInputElement>("#nonempty-file");
const configInput = document.querySelector<HTMLInputElement>("#config-file");
const seedInput = document.querySelector<HTMLInputElement>("#seed-input");

if (!form || !status || !ddInput || !nonemptyInput || !configInput || !seedInput) {
  throw new Error("Missing required UI elements.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ddFile = ddInput.files?.[0];
  const nonemptyFile = nonemptyInput.files?.[0];
  const configFile = configInput.files?.[0];
  if (!ddFile || !nonemptyFile || !configFile) {
    status.textContent = "Please select all required files.";
    return;
  }

  try {
    status.textContent = "Generating outputs...";
    const [ddCsvText, nonEmptyText, configText] = await Promise.all([
      ddFile.text(),
      nonemptyFile.text(),
      configFile.text()
    ]);
    const seedOverride = seedInput.value ? Number(seedInput.value) : undefined;
    const artifacts = await generateArtifactsBrowser(ddCsvText, nonEmptyText, configText, seedOverride);

    const zip = new JSZip();
    zip.file("population.clean.csv", artifacts.cleanCsv);
    zip.file("population.dirty.csv", artifacts.dirtyCsv);
    zip.file("metadata.json", artifacts.metadataJson);
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "mock-population-output.zip");
    status.textContent = "Done. Download started.";
  } catch (error) {
    status.textContent = error instanceof Error ? `Error: ${error.message}` : "Unknown error";
  }
});

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
