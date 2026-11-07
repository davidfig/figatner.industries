# figatner.industries

The website for Figatner Industries, the company behind [Golem Docs](https://golemdocs.com) and [satchel.email](https://satchel.email). It's live at [figatner.industries](https://figatner.industries).

The page sits on a live WebGL sky: a sun, clouds and smoke printed as three spot inks through out-of-register halftone screens. The day passes as you scroll, and a fast-moving cursor stirs the smoke it passes through. The logo and name are hand-drawn SVG, with no font behind them.

## Layout

| Path | What's there |
| --- | --- |
| `designs/sky/` | The site's source: the page, the WebGL sky, images and self-hosted fonts |
| `designs/shared/wordmark.js` | The hand-drawn letters, with their spacing and alignment |
| `scripts/build-site.mjs` | Builds the deployable site into `site/public` |
| `site/` | Cloudflare config for the site |
| `site/redirect/` | A small Worker that sends `www` and `figatnerindustries.com` to the main domain |

## Run it locally

There's no install step. Serve `designs/` and open the Sky page. The page needs WebGL2.

```sh
python3 -m http.server 8090 --directory designs
```

Then go to <http://localhost:8090/sky/>.

## Build and deploy

The site deploys to Cloudflare as a static Worker. You need Node 22 or newer and a Cloudflare login.

```sh
node scripts/build-site.mjs
cd site && npx wrangler deploy
```

The redirect Worker only needs deploying when its addresses change, with `cd site/redirect && npx wrangler deploy`.

## License

The code is [MIT licensed](LICENSE). That license doesn't cover:

- **Names, logos and the hand-drawn lettering.** The Figatner Industries, Golem Docs and satchel.email marks aren't licensed: see [TRADEMARKS.md](TRADEMARKS.md). That includes the logo drawing and letter outlines, even where they appear in source files.
- **Product screenshots and images** in `designs/sky/img/`.
- **Fonts** in `designs/sky/fonts/`, which keep their own [SIL Open Font License](designs/sky/fonts/OFL-Newsreader.txt).
