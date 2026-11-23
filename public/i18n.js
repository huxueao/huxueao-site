const KEY = 'janus-language';
let language = 'en';
try { language = localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en'; } catch {}
export const getLanguage = () => language;
export const t = (en, zh) => language === 'zh' ? zh : en;
export function setLanguage(value) {
  language = value === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem(KEY, language); } catch {}
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  window.dispatchEvent(new Event('janus:language'));
}
export function languageButton() {
  return `<button class="language-button" type="button" data-language aria-label="${t('Switch to Chinese', '切换到英文')}"><span ${language === 'en' ? 'class="active-language"' : ''}>EN</span><span aria-hidden="true">/</span><span ${language === 'zh' ? 'class="active-language"' : ''}>中文</span></button>`;
}
export function bindLanguageButton(root = document) {
  const click = event => { if (event.target.closest('[data-language]')) setLanguage(language === 'en' ? 'zh' : 'en'); };
  root.addEventListener('click', click);
  return () => root.removeEventListener('click', click);
}
