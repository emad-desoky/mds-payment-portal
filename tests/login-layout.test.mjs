import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('login route renders role-aware login experience', () => {
  const login = read('app/login/page.jsx');
  assert.match(login, /import LoginExperience from/);
  assert.match(login, /<LoginExperience\s*\/>/);
  assert.doesNotMatch(login, /<LoginPanel\s*\/>/);
});

test('role-specific illustrations are available and referenced', () => {
  const experience = read('components/LoginExperience.jsx');
  for (const name of ['client-access.avif', 'finance-access.avif']) {
    assert.ok(existsSync(`${root}/public/brand/${name}`));
    assert.ok(experience.includes(`/brand/${name}`));
  }
  assert.match(experience, /onTabChange=\{setTab\}/);
});

test('responsive login layout keeps visuals visible', () => {
  const css = read('app/polish.css');
  assert.match(css, /auth-layout-polished \.auth-picture-wrap/);
  assert.match(css, /auth-layout-polished \.auth-picture/);
  assert.match(css, /@media \(max-width: 900px\)/);
});
