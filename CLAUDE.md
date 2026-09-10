# Paradigm DTTRPG — working notes for Claude

Core game source (React/Vite), consumed by two downstream targets:
- The Firefox extension shell at `../../WebDev/Projects/paradigm extension`
  — `npm run build` here writes straight into that repo's `dist/` via an
  absolute `outDir` in `vite.config.js`.
- A mobile-testable build published as a private Claude Artifact —
  `npx vite build --config vite.mobile.config.js` produces `dist-mobile/`.
  `mobile-artifact/build.sh` rebuilds and restitches the artifact's final
  HTML in one step (`mobile-artifact/output.html`); publish that via the
  Artifact tool to the *existing* artifact URL (see Claude's own memory —
  reference-repo-locations) so it updates in place.

## At the end of any session with real gameplay/UI changes

- Ask whether to commit. This repo has a track record of sessions ending
  with a clean, working, live-tested build and an uncommitted working
  tree — the entire mobile build pipeline sat untracked for two-plus weeks
  this way before anyone noticed.
- Ask whether to also rebuild + republish the mobile Artifact
  (`./mobile-artifact/build.sh`, then publish `mobile-artifact/output.html`
  with `url` set to the existing artifact). Nothing does this
  automatically — it only happens if it's asked about.
