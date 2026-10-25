import { APP_VERSION, versionInfo } from './version';

describe('versionInfo', () => {
  it('links a release to its notes', () => {
    expect(versionInfo('v1.2.3')).toEqual({
      label: 'v1.2.3',
      title: 'Release notes for v1.2.3',
      url: 'https://github.com/xfxian/ministoregen/releases/tag/v1.2.3',
    });
  });

  it('links a preview to its pull request', () => {
    expect(versionInfo('preview-pr17')).toMatchObject({ label: 'preview #17', url: 'https://github.com/xfxian/ministoregen/pull/17' });
  });

  it('shows other builds as they are, without a link', () => {
    expect(versionInfo('v0.2.0-3-gabc1234')).toMatchObject({ label: 'v0.2.0-3-gabc1234', url: null });
    expect(versionInfo('dev')).toMatchObject({ label: 'dev', url: null });
  });

  it('has a version stamped in', () => {
    expect(APP_VERSION).toMatch(/\S/);
  });
});
