// Builds the deployable site in site/public from the Sky design: only the files
// that page needs, without the prototype switcher or placeholder footer links.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'designs')
const to = join(root, 'site', 'public')

function replaceOnce(text, find, replacement) {
    if (!text.includes(find)) throw new Error(`Expected to find: ${find}`)
    return text.replaceAll(find, replacement)
}

rmSync(to, { recursive: true, force: true })
mkdirSync(join(to, 'shared'), { recursive: true })

let html = readFileSync(join(from, 'sky/index.html'), 'utf8')
html = replaceOnce(html, '<script type="module" src="../shared/bar.js"></script>\n', '')
html = replaceOnce(html, '<a href="#">Privacy</a><a href="#">Terms</a><a href="#">Trademarks</a>', '')
html = replaceOnce(html, "'../shared/wordmark.js'", "'./shared/wordmark.js'")
writeFileSync(join(to, 'index.html'), html)

const main = readFileSync(join(from, 'sky/main.js'), 'utf8')
writeFileSync(join(to, 'main.js'), main.replaceAll("'../shared/", "'./shared/"))

for (const file of ['gl.js', 'riso.js', 'wordmark.js']) cpSync(join(from, 'shared', file), join(to, 'shared', file))
cpSync(join(from, 'sky/img'), join(to, 'img'), { recursive: true })
cpSync(join(from, 'sky/fonts'), join(to, 'fonts'), { recursive: true })
rmSync(join(to, 'img/.DS_Store'), { force: true })
