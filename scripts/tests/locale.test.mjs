import test from 'node:test';
import assert from 'node:assert/strict';
import {
  languages, defaultLanguage, languageOptions, languagePreferenceKey,
  preferredLanguage, rootLanguageTarget, redirectRootLanguage, rememberLanguage,
} from '../../src/locale.mjs';

function browserFor(pathname = '/', browserLanguages = ['ja-JP']) {
  const values = new Map();
  return {
    location: { pathname, search: '', hash: '', replace(target) { this.target = target; } },
    navigator: { languages: browserLanguages, language: browserLanguages[0] },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
  };
}

test('Chinese leads the menu and is the unsupported-language fallback', () => {
  assert.deepEqual(languages, ['zh-cn', 'ja', 'en']);
  assert.equal(languageOptions[0][0], 'zh-cn');
  assert.equal(defaultLanguage, 'zh-cn');
  assert.equal(preferredLanguage(null, ['ko-KR', 'fr-FR']), 'zh-cn');
  assert.equal(preferredLanguage(null), 'zh-cn');
});

test('regional browser languages follow the first supported preference', () => {
  for (const language of ['zh-CN', 'zh-TW', 'zh-Hant-HK', 'zh_SG']) {
    assert.equal(preferredLanguage(null, [language]), 'zh-cn');
  }
  assert.equal(preferredLanguage(null, ['ja-JP', 'zh-CN']), 'ja');
  assert.equal(preferredLanguage(null, ['de-DE', 'en-US', 'ja-JP']), 'en');
  assert.equal(preferredLanguage(null, [null, 3, ' JA-jp ']), 'ja');
});

test('only supported manual choices override browser detection', () => {
  assert.equal(preferredLanguage('en', ['zh-CN']), 'en');
  assert.equal(preferredLanguage('ja', ['en-US']), 'ja');
  assert.equal(preferredLanguage('ko', ['en-US']), 'en');
  assert.equal(preferredLanguage('https://other.test', ['zh-CN']), 'zh-cn');
});

test('root redirection preserves campaign parameters and anchors', () => {
  const location = { pathname: '/', search: '?from=bilibili', hash: '#news' };
  assert.equal(rootLanguageTarget(location, null, ['ja-JP']), '/ja/?from=bilibili#news');
});

test('explicit pages and unavailable Korean URLs never auto-redirect', () => {
  for (const path of ['/zh-cn/', '/ja/guides/first-steps/', '/en/data/officers/1/', '/ko/', '/missing/']) {
    const browser = browserFor(path);
    assert.equal(redirectRootLanguage(browser), false);
    assert.equal(browser.location.target, undefined);
  }
});

test('manual selection persists and wins on the next root visit', () => {
  const browser = browserFor();
  rememberLanguage('en', browser);
  assert.equal(browser.localStorage.getItem(languagePreferenceKey), 'en');
  assert.equal(redirectRootLanguage(browser), true);
  assert.equal(browser.location.target, '/en/');
  rememberLanguage('ko', browser);
  assert.equal(browser.localStorage.getItem(languagePreferenceKey), 'en');
});

test('blocked browser storage does not break navigation or detection', () => {
  const browser = browserFor();
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  assert.doesNotThrow(() => rememberLanguage('zh-cn', browser));
  assert.equal(redirectRootLanguage(browser), true);
  assert.equal(browser.location.target, '/ja/');
});

test('navigator.language remains usable when languages is unavailable', () => {
  const browser = browserFor();
  browser.navigator = { language: 'en-GB' };
  redirectRootLanguage(browser);
  assert.equal(browser.location.target, '/en/');
});

