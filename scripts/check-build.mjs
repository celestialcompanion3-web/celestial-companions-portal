// Proves that the demo stand-in and the sample data are NOT in a normal (production) build.
// It builds the site twice into temporary folders:
//   1. a normal build, which must contain none of the demo markers, and
//   2. a demo build, which must contain all of them (this shows the check itself works).
// It also looks for anything that resembles a secret key in the normal build.
// Run with:  npm run check:build
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

// Text that only exists in the demo code or its sample data.
const demoMarkers = ['__demoDb', 'ccom-demo-state', 'owner@example.com', 'demo.invalid', 'Demo mode. Sign in as', 'Sam Owner', 'A sample answer that was saved earlier']
// Content that belongs in the database only. The site's files must be an empty shell.
const contentMarkers = ['Celestial Companions Blueprint', 'Weekly report: week of 14 September', 'Guided demo', 'Ms Kay']
// Things that must never be shipped in a browser bundle.
const secretPatterns = [/service_role/i, /sb_secret_[A-Za-z0-9_-]{10,}/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/]

function build(mode, outDir) {
  const args = [viteBin, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error']
  if (mode) args.push('--mode', mode)
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' })
  if (run.status !== 0) {
    console.error(run.stdout, run.stderr)
    throw new Error(`The ${mode ?? 'production'} build failed.`)
  }
}

function readAll(dir) {
  let text = ''
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    text += statSync(path).isDirectory() ? readAll(path) : readFileSync(path, 'utf8') + '\n'
  }
  return text
}

const work = mkdtempSync(join(tmpdir(), 'ccom-check-'))
let failed = 0
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`)
  if (!ok) failed++
}

try {
  const prodDir = join(work, 'prod')
  const demoDir = join(work, 'demo')
  build(undefined, prodDir)
  build('demo', demoDir)
  const prod = readAll(prodDir)
  const demo = readAll(demoDir)

  for (const marker of demoMarkers) {
    check(demo.includes(marker), `the demo build contains "${marker}" (so the check can see it)`)
    check(!prod.includes(marker), `the production build does NOT contain "${marker}"`)
  }
  for (const marker of contentMarkers) {
    check(!prod.includes(marker), `the production build has no page content: "${marker}"`)
  }
  for (const pattern of secretPatterns) {
    check(!pattern.test(prod), `the production build has nothing matching ${pattern}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nThe production build contains no demo code and no page content.')
