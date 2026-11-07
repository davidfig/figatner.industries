// Builds the deployable site in site/public from designs/sky: only the files
// its pages need.
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

// Pages link to each other as .html so they work from a plain file server; the
// deployed site uses Cloudflare's clean addresses.
const cleanLinks = text => text.replace(/href="(privacy|terms|trademarks)\.html"/g, 'href="/$1"')

for (const page of ['index.html', 'privacy.html', 'terms.html', 'trademarks.html']) {
    let html = readFileSync(join(from, 'sky', page), 'utf8')
    html = replaceOnce(html, "'../shared/wordmark.js'", "'./shared/wordmark.js'")
    writeFileSync(join(to, page), cleanLinks(html))
}

const main = readFileSync(join(from, 'sky/main.js'), 'utf8')
writeFileSync(join(to, 'main.js'), main.replaceAll("'../shared/", "'./shared/"))

for (const file of ['404.html', 'legal.css', 'robots.txt', 'sitemap.xml', 'og.jpg', 'apple-touch-icon.png']) cpSync(join(from, 'sky', file), join(to, file))
for (const file of ['gl.js', 'wordmark.js']) cpSync(join(from, 'shared', file), join(to, 'shared', file))
cpSync(join(from, 'sky/img'), join(to, 'img'), { recursive: true })
cpSync(join(from, 'sky/fonts'), join(to, 'fonts'), { recursive: true })
rmSync(join(to, 'img/.DS_Store'), { force: true })
