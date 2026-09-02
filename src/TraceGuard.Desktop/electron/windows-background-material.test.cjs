const assert = require('node:assert/strict');
const test = require('node:test');
const {
  setCompatibleBackgroundMaterial,
  supportsWindowsBackgroundMaterial,
  windowsBuildNumber,
  withCompatibleBackgroundMaterial,
} = require('./windows-background-material.cjs');

const windowsRelease = (build) => ({ platform: 'win32', release: `10.0.${build}` });

test('extracts the Windows build number from an OS release', () => {
  assert.equal(windowsBuildNumber('10.0.19045'), 19045);
  assert.equal(windowsBuildNumber('10.0.26100'), 26100);
});

test('uses the CSS fallback on Windows 10 build 19045', () => {
  const environment = windowsRelease(19045);
  assert.equal(supportsWindowsBackgroundMaterial(environment), false);
  assert.deepEqual(
    withCompatibleBackgroundMaterial({ width: 800, backgroundMaterial: 'mica' }, environment),
    { width: 800 },
  );
});

test('uses the CSS fallback on Windows 11 build 22000', () => {
  const environment = windowsRelease(22000);
  assert.equal(supportsWindowsBackgroundMaterial(environment), false);
  assert.deepEqual(
    withCompatibleBackgroundMaterial({ transparent: true, backgroundMaterial: 'acrylic' }, environment),
    { transparent: true },
  );
});

test('enables native background material on Windows 11 build 22621', () => {
  const environment = windowsRelease(22621);
  const options = { width: 800, backgroundMaterial: 'mica' };
  assert.equal(supportsWindowsBackgroundMaterial(environment), true);
  assert.deepEqual(withCompatibleBackgroundMaterial(options, environment), options);
});

test('enables native background material on Windows 11 build 26100', () => {
  const environment = windowsRelease(26100);
  const calls = [];
  const window = { setBackgroundMaterial: (material) => calls.push(material) };
  assert.equal(supportsWindowsBackgroundMaterial(environment), true);
  assert.equal(setCompatibleBackgroundMaterial(window, 'acrylic', environment), true);
  assert.deepEqual(calls, ['acrylic']);
});

test('does not call setBackgroundMaterial on unsupported Windows builds', () => {
  let called = false;
  const window = { setBackgroundMaterial: () => { called = true; } };
  assert.equal(setCompatibleBackgroundMaterial(window, 'mica', windowsRelease(19045)), false);
  assert.equal(called, false);
});
