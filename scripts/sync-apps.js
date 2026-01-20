import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default relative path to serverless-llm repo assuming sibling directories
// Repo structure:
// .../chrome-extensions/extensions/shipctl/scripts/sync-apps.js
// .../serverless-llm
// So we need to go up from scripts (1) -> shipctl (2) -> extensions (3) -> chrome-extensions (4) -> github root
// Then down to serverless-llm.
// So ../../../../serverless-llm
const DEFAULT_REPO_PATH = '../../../serverless-llm';
const MANIFEST_PATH = '.shipctl/apps.json';
const OUTPUT_PATH = '../src/data/extension-config.json'; // Relative to scripts dir

const repoPath = process.argv[2] || DEFAULT_REPO_PATH;
const fullManifestPath = path.resolve(__dirname, repoPath, MANIFEST_PATH);
const fullOutputPath = path.resolve(__dirname, OUTPUT_PATH);

console.log(`ShipCTL Sync Apps`);
console.log(`=================`);
console.log(`Searching for manifest at: ${fullManifestPath}`);

if (!fs.existsSync(fullManifestPath)) {
    console.error(`❌ Error: Manifest not found at ${fullManifestPath}`);
    console.error(`Usage: npm run sync [path-to-serverless-llm-repo]`);
    process.exit(1);
}

try {
    const content = fs.readFileSync(fullManifestPath, 'utf8');
    // Validate JSON
    const json = JSON.parse(content);

    if (!json.services || !json.workflows) {
        throw new Error("Invalid manifest format: missing 'services' or 'workflows'");
    }

    fs.writeFileSync(fullOutputPath, content);
    console.log(`✓ Configuration synced successfully!`);
    console.log(`  - Services: ${json.services.length}`);
    console.log(`  - Workflows: ${json.workflows.length}`);
    console.log(`  - Written to: ${fullOutputPath}`);

} catch (err) {
    console.error(`❌ Failed to sync config: ${err.message}`);
    process.exit(1);
}
