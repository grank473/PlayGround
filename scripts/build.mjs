import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceDir = join(projectDir, 'src')
const outputDir = join(projectDir, 'dist')
const manifestPath = join(outputDir, '.build-manifest')

async function walk(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...await walk(join(directory, entry.name), relative))
    else if (entry.isFile()) files.push(relative)
  }
  return files
}

async function fingerprint() {
  const hash = createHash('sha256')
  for (const relative of await walk(sourceDir)) {
    hash.update(relative)
    hash.update(await readFile(join(sourceDir, relative)))
  }
  return hash.digest('hex')
}

async function existsInOutput(relative) {
  try {
    return (await stat(join(outputDir, relative))).isFile()
  } catch {
    return false
  }
}

try {
  await stat(sourceDir)
} catch {
  throw new Error(`Missing source directory: ${sourceDir}`)
}

const nextHash = await fingerprint()
let previousHash = ''
try {
  previousHash = (await readFile(manifestPath, 'utf8')).trim()
} catch {}

const upToDate = previousHash === nextHash && await existsInOutput('index.html') && process.env.FORCE_BUILD !== '1'

if (upToDate) {
  console.log(`Build is up to date (${nextHash.slice(0, 12)}); reusing ${outputDir}`)
} else {
  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })
  await cp(sourceDir, outputDir, { recursive: true })
  await writeFile(manifestPath, `${nextHash}\n`)
  console.log(`Built ${sourceDir} -> ${outputDir} (${nextHash.slice(0, 12)})`)
}
