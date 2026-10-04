# 思源宋体 / Noto Serif SC

The website uses the same Noto Serif SC design shown in the font comparison,
distributed as `@fontsource-variable/noto-serif-sc` version 5.2.10.

- Upstream: https://github.com/google/fonts/tree/main/ofl/notoserifsc
- Fontsource: https://fontsource.org/fonts/noto-serif-sc
- License: SIL Open Font License 1.1; see `LICENSE.txt` in this directory.
- The global CSS import lets Next.js bundle and self-host the original WOFF2
  slices. Unicode ranges load only the slices needed by each page.
- Supported variable weight axis: 200–900. Body copy and card titles use 400;
  hero headings use 500.

No runtime request to a third-party font CDN is required.
