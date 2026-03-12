import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_DIR = join(homedir(), '.pippit')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

export interface LocalConfig {
  jwt: string | null
  apiKey: string | null
  preferredModel: string
}

const DEFAULT_CONFIG: LocalConfig = {
  jwt: null,
  apiKey: null,
  preferredModel: 'openrouter/auto:free',
}

export async function readConfig(): Promise<LocalConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    // migrate old anthropicApiKey field
    if (parsed.anthropicApiKey && !parsed.apiKey) {
      parsed.apiKey = parsed.anthropicApiKey
      delete parsed.anthropicApiKey
    }
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function writeConfig(config: Partial<LocalConfig>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  const existing = await readConfig()
  await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, ...config }, null, 2))
}
