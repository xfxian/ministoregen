/* global __APP_VERSION__ */

const REPO_URL = 'https://github.com/xfxian/ministoregen';

/** The version stamped in at build time (see vite.config.js). */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : 'dev';

/**
 * What the header shows for a version: a release links to its notes, a pull
 * request preview to its pull request; anything else is shown as it is.
 */
export function versionInfo(version = APP_VERSION) {
  if (/^v\d+\.\d+\.\d+$/.test(version)) {
    return { label: version, title: `Release notes for ${version}`, url: `${REPO_URL}/releases/tag/${version}` };
  }
  const preview = /^preview-pr(\d+)$/.exec(version);
  if (preview) {
    return { label: `preview #${preview[1]}`, title: 'Preview of an unreleased change', url: `${REPO_URL}/pull/${preview[1]}` };
  }
  return { label: version, title: 'Development build', url: null };
}
