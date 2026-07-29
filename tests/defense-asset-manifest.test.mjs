import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { RETAINED_ASSET_PATHS } from '../scripts/defense-runtime-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets/defense-asset-manifest.json');
const retainedPaths = new Set(RETAINED_ASSET_PATHS);

function trackedAssetPaths() {
  const result = spawnSync('git', ['ls-files', '-z', 'assets'], {
    cwd: root,
    encoding: 'buffer',
  });
  assert.equal(result.status, 0, result.stderr.toString('utf8'));
  const currentPaths = new Set(result.stdout.toString('utf8').split('\0').filter(Boolean));
  // The manifest builder also retains any RETAINED_ASSET_PATHS entry that
  // exists on disk, even before it is git-committed, so newly generated
  // runtime assets receive manifest rows ahead of the commit that adds
  // them. Mirror that union here or this completeness check would demand
  // the manifest omit rows for assets that genuinely exist and are kept.
  for (const retainedPath of retainedPaths) {
    if (existsSync(resolve(root, retainedPath))) currentPaths.add(retainedPath);
  }
  return [...currentPaths].sort((left, right) => left.localeCompare(right));
}

test('defense asset manifest has literal, complete dispositions when generated', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.generatedBy, 'scripts/build-defense-asset-manifest.mjs');
  assert.equal(
    manifest.regeneration,
    'Run node scripts/build-defense-asset-manifest.mjs --write before the destructive deletion commit.',
  );
  assert.equal(typeof manifest.pendingGeneration, 'boolean');
  assert.ok(Array.isArray(manifest.rows));
  assert.ok(Array.isArray(manifest.historicalDeletionRows));

  if (manifest.pendingGeneration) {
    assert.deepEqual(manifest.rows, []);
    return;
  }

  for (const retainedPath of RETAINED_ASSET_PATHS) {
    assert.deepEqual(
      manifest.rows
        .filter((row) => row.currentPath === retainedPath)
        .map(({ disposition, replacementPath, runtimeReference }) => ({
          disposition,
          replacementPath,
          runtimeReference,
        })),
      [{ disposition: 'retain', replacementPath: retainedPath, runtimeReference: true }],
      `${retainedPath} must have exactly one retained runtime manifest row`,
    );
  }

  const currentPaths = trackedAssetPaths();
  const paths = manifest.rows.map((row) => row.currentPath);
  assert.deepEqual(paths, [...paths].sort((left, right) => left.localeCompare(right)));
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths, currentPaths);

  for (const row of manifest.rows) {
    assert.deepEqual(Object.keys(row).sort(), [
      'currentPath',
      'disposition',
      'extension',
      'generator',
      'replacementPath',
      'runtimeReference',
      'testDisposition',
    ]);
    assert.ok(row.currentPath.startsWith('assets/'));
    assert.equal(row.currentPath.includes('*'), false);
    assert.equal(row.currentPath.endsWith('/'), false);
    assert.equal(row.extension, extname(row.currentPath));
    assert.equal(row.generator, 'scripts/build-defense-asset-manifest.mjs');
    assert.ok(['retain', 'delete'].includes(row.disposition));
    assert.equal(row.testDisposition, row.disposition);

    const retained = retainedPaths.has(row.currentPath);
    assert.equal(row.disposition, retained ? 'retain' : 'delete');
    assert.equal(row.runtimeReference, retained);
    assert.equal(row.replacementPath, retained ? row.currentPath : null);

    assert.equal(/^assets\/video\//.test(row.currentPath) && retained, false);
    assert.equal(/\/action-[^/]+$/.test(row.currentPath) && retained, false);
    assert.equal(/^assets\/images\/resource-refinement\//.test(row.currentPath) && retained, false);
  }

  const historicalPaths = manifest.historicalDeletionRows.map((row) => row.currentPath);
  assert.deepEqual(historicalPaths, [...historicalPaths].sort((left, right) => left.localeCompare(right)));
  assert.equal(new Set(historicalPaths).size, historicalPaths.length);
  for (const row of manifest.historicalDeletionRows) {
    assert.equal(row.disposition, 'delete');
    assert.equal(row.testDisposition, 'delete');
    assert.equal(row.runtimeReference, false);
    assert.equal(row.replacementPath, null);
    assert.equal(row.extension, extname(row.currentPath));
    assert.equal(row.generator, 'scripts/build-defense-asset-manifest.mjs');
    assert.equal(currentPaths.includes(row.currentPath), false);
  }
});

test('Cinder Span packaged terrain resources remain retained runtime assets', () => {
  const directPaths = [
    'assets/mesh/terrain/terrain-cinder-span/runtime/terrain/terrain-cinder-span.glb',
    'assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-features.glb',
    'assets/mesh/terrain/terrain-cinder-span/runtime/packs/terrain-cinder-span-props.glb',
    'assets/mesh/terrain/terrain-cinder-span/runtime/terrain-cinder-span-resources.manifest.json',
  ];
  const retiredWorldPlates = [
    'assets/images/battle/world/cinder-span-topdown-plate.webp',
    'assets/images/battle/world/cinder-span-tactical-paper-plate.webp',
  ];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  for (const path of directPaths) {
    assert.ok(retainedPaths.has(path), `${path} must be retained for the runtime`);
  }
  for (const path of retiredWorldPlates) {
    assert.equal(retainedPaths.has(path), false, `${path} must not re-enter the runtime asset closure`);
  }

  if (manifest.pendingGeneration) return;

  for (const path of directPaths) {
    assert.deepEqual(
      manifest.rows.find((row) => row.currentPath === path),
      {
        currentPath: path,
        disposition: 'retain',
        extension: extname(path),
        generator: 'scripts/build-defense-asset-manifest.mjs',
        replacementPath: path,
        runtimeReference: true,
        testDisposition: 'retain',
      },
      `${path} must have an exact retained manifest disposition`,
    );
  }
});
