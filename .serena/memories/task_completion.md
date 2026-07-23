# Completion checks
- Unit/contract suite: `node --test tests/defense-run-simulation.test.mjs tests/defense-campaign-adapter.test.mjs tests/defense-renderer-contract.test.mjs tests/defense-asset-manifest.test.mjs tests/no-rts-closure.test.mjs tests/defense-cutscene.test.mjs tests/defense-expansion-contract.test.mjs tests/defense-observers-contract.test.mjs tests/defense-stat-delta-browser.test.mjs tests/release-closure.test.mjs`.
- Browser journeys: `node tests/defense-survivor-browser.cjs` and `node tests/defense-hud-responsive-browser.cjs`.
- Performance probe: `node tests/defense-performance-browser.cjs`.
- A significant gameplay change needs the directly relevant deterministic and browser checks; status is not complete if gate evidence is absent.