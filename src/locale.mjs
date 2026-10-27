export const languages = Object.freeze(['zh-cn', 'ja', 'en']);
export const defaultLanguage = languages[0];
export const languageOptions = [
  ['zh-cn', '中文'], ['ja', '日本語'], ['en', 'EN'], ['ko', '한국어'],
];
export const languagePreferenceKey = '3kranse.language';

export function preferredLanguage(savedLanguage, browserLanguages = []) {
  // Only an explicit, supported choice overrides the browser; Korean remains a 404 preview.
  if (languages.includes(savedLanguage)) return savedLanguage;
  for (const value of Array.isArray(browserLanguages) ? browserLanguages : []) {
    const base = typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';
    const language = base === 'zh' ? 'zh-cn' : base;
    if (languages.includes(language)) return language;
  }
  return defaultLanguage;
}

export function readLanguagePreference(browser = window) {
  try { return browser.localStorage.getItem(languagePreferenceKey); }
  catch { return null; }
}

export function rememberLanguage(language, browser = window) {
  if (!languages.includes(language)) return;
  // Restricted browsers can block storage; an ordinary language link must still work.
  try { browser.localStorage.setItem(languagePreferenceKey, language); }
  catch { /* A failed preference write must never block navigation. */ }
}

export function rootLanguageTarget(location, savedLanguage, browserLanguages) {
  // Shared articles, explicit locales and 404 URLs keep the language in their address.
  if (location.pathname !== '/') return null;
  const language = preferredLanguage(savedLanguage, browserLanguages);
  return '/' + language + '/' + (location.search || '') + (location.hash || '');
}

export function redirectRootLanguage(browser = window) {
  if (browser.location.pathname !== '/') return false;
  const browserLanguages = browser.navigator.languages?.length
    ? browser.navigator.languages : [browser.navigator.language];
  const target = rootLanguageTarget(browser.location, readLanguagePreference(browser), browserLanguages);
  // Replace avoids a Back-button loop through the automatic language entry.
  browser.location.replace(target);
  return true;
}

