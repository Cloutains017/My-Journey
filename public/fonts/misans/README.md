# MiSans

This website uses MiSans, created by Xiaomi together with Monotype and Hanyi.

Original WOFF2 font slices are served locally, with unchanged glyphs and the
original Unicode ranges supplied by Xiaomi's font service. A single variable
family covers the 150–700 weight axis. MiSans uses a nonstandard weight scale:
Regular is 330, Medium is 380 and Demibold is 450. The browser requests only
the slices needed for the text it displays.

Source: https://hr.xiaomi.com/website/assets/fonts/global.css

License and embedding guidance: https://hyperos.mi.com/font/zh/faq/

The font remains the property of its respective copyright holders. It is
included as an embedded website font, not offered as a standalone font package.
MiSans attribution is also shown in the website footer.

Regenerate the local assets with `python scripts/vendor-misans-fonts.py`.
`manifest.json` records each upstream asset and its SHA-256 digest.
