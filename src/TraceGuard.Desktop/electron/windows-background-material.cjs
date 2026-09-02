const MINIMUM_BACKGROUND_MATERIAL_BUILD = 22621;

function windowsBuildNumber(release) {
  if (typeof release !== 'string') return 0;
  const build = Number.parseInt(release.split('.')[2] ?? '', 10);
  return Number.isSafeInteger(build) && build > 0 ? build : 0;
}

function supportsWindowsBackgroundMaterial({ platform, release }) {
  return platform === 'win32' && windowsBuildNumber(release) >= MINIMUM_BACKGROUND_MATERIAL_BUILD;
}

function withCompatibleBackgroundMaterial(options, environment) {
  if (supportsWindowsBackgroundMaterial(environment)) return { ...options };
  const { backgroundMaterial: _unsupportedMaterial, ...cssFallbackOptions } = options;
  return cssFallbackOptions;
}

function setCompatibleBackgroundMaterial(window, material, environment) {
  if (!supportsWindowsBackgroundMaterial(environment) || typeof window?.setBackgroundMaterial !== 'function') return false;
  try {
    window.setBackgroundMaterial(material);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  MINIMUM_BACKGROUND_MATERIAL_BUILD,
  setCompatibleBackgroundMaterial,
  supportsWindowsBackgroundMaterial,
  windowsBuildNumber,
  withCompatibleBackgroundMaterial,
};
