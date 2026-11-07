// The little switcher on each prototype. Not part of any design.
const designs = [['sky', 'Sky'], ['logo', 'Logos'], ['wordmark', 'Lettering']]
const current = location.pathname.split('/').filter(Boolean).at(-1)

const bar = document.createElement('nav')
bar.setAttribute('aria-label', 'Design prototypes')
bar.attachShadow({ mode: 'open' }).innerHTML = `
<style>
:host { position: fixed; right: 12px; bottom: 12px; z-index: 1000; }
div { display: flex; gap: 2px; padding: 3px; border-radius: 9px; background: rgba(20, 20, 20, .86);
      backdrop-filter: blur(6px); font: 500 12px/1 ui-sans-serif, system-ui, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,.3); }
a { color: #ddd; text-decoration: none; padding: 7px 9px; border-radius: 6px; white-space: nowrap; }
a:hover { background: rgba(255,255,255,.14); }
a[aria-current] { background: #f2ede2; color: #111; }
@media (max-width: 560px) { a { padding: 6px 6px; font-size: 11px; } }
</style>
<div>
<a href="../" title="All designs">All</a>
${designs.map(([slug, name]) => `<a href="../${slug}/"${slug === current ? ' aria-current="page"' : ''}>${name}</a>`).join('')}
</div>`
document.body.append(bar)
