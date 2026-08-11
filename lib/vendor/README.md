Vendored third-party code, used because the extension has no build step (no
npm/bundler) to pull dependencies in at build time.

- **js-yaml.min.js** - [js-yaml](https://github.com/nodeca/js-yaml) v4.3.1,
  minified browser (UMD) build, fetched from
  `https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js`. Exposes a
  global `jsyaml` object (`jsyaml.load(text)`) when loaded via a plain
  `<script>` tag. MIT licensed - see `js-yaml.LICENSE.txt`.
