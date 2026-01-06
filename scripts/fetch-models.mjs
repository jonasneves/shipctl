#!/usr/bin/env node
/**
 * Fetch GitHub Models catalog at build time and save as static JSON
 * This allows the extension to work without a backend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_MODELS_CATALOG_URL = 'https://models.github.ai/catalog/models';

function getLocalModels() {
    try {
        const configPath = path.resolve(__dirname, '../src/data/extension-config.json');
        console.log(`📡 Loading local models from: ${configPath}`);

        if (!fs.existsSync(configPath)) {
            console.warn('⚠️ extension-config.json not found. Run npm run sync first.');
            return [];
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (config.models && Array.isArray(config.models)) {
            return config.models.map(m => ({
                id: m.id,
                name: m.name,
                type: 'local',
                priority: m.priority || 10,
                category: m.category,
                // Default context length since it's not in manifest yet
                context_length: 32768
            }));
        }
        return [];
    } catch (err) {
        console.error('❌ Failed to load local config:', err.message);
        return [];
    }
}

async function fetchGitHubModels() {
    console.log('📡 Fetching GitHub Models catalog...');

    try {
        const response = await fetch(GITHUB_MODELS_CATALOG_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const catalog = await response.json();
        console.log(`✅ Fetched ${catalog.length} models from GitHub catalog`);

        // Filter to chat-capable models (exclude embeddings)
        const chatModels = catalog.filter(m =>
            m.supported_output_modalities?.includes('text') &&
            !m.supported_output_modalities?.includes('embeddings')
        );

        // Transform to our format
        const apiModels = chatModels.map((m, index) => ({
            id: m.id,
            name: m.name,
            type: 'api',
            priority: index + 1,
            context_length: m.limits?.max_input_tokens || 128000,
            publisher: m.publisher,
            summary: m.summary,
            capabilities: m.capabilities || [],
        }));

        console.log(`✅ Processed ${apiModels.length} chat-capable API models`);
        return apiModels;

    } catch (error) {
        console.error('❌ Failed to fetch GitHub Models catalog:', error.message);
        console.log('⚠️ Using fallback API models list');

        // Fallback static list
        return [
            { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', type: 'api', priority: 1, context_length: 131072 },
            { id: 'openai/gpt-4.1', name: 'OpenAI GPT-4.1', type: 'api', priority: 2, context_length: 1048576 },
            { id: 'deepseek/deepseek-v3-0324', name: 'DeepSeek-V3-0324', type: 'api', priority: 3, context_length: 128000 },
            { id: 'meta/llama-3.3-70b-instruct', name: 'Llama-3.3-70B-Instruct', type: 'api', priority: 4, context_length: 128000 },
            { id: 'mistral-ai/mistral-small-2503', name: 'Mistral Small 3.1', type: 'api', priority: 5, context_length: 128000 },
        ];
    }
}

async function main() {
    const localModels = getLocalModels();
    console.log(`✅ Loaded ${localModels.length} local models from manifest`);

    const apiModels = await fetchGitHubModels();

    const allModels = {
        models: [...localModels, ...apiModels],
        fetchedAt: new Date().toISOString(),
        source: 'build-time',
    };

    // Write to file
    const outPath = path.join(process.cwd(), 'public', 'models.json');
    fs.writeFileSync(outPath, JSON.stringify(allModels, null, 2));
    console.log(`\n✅ Wrote ${allModels.models.length} models to ${outPath}`);
}

main().catch(console.error);
