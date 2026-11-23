import { escapeHTML as esc, markdown, date, safeLink } from './format.js';
import { t, getLanguage, languageButton, bindLanguageButton } from './i18n.js';
import { mountMascot } from './mascot.js';

const main = document.querySelector('#main');
let entries = [], loadError = false, gameCleanup = null, renderId = 0;
const entryLink = entry => `/entry/${encodeURIComponent(entry.slug)}`;
const writing = () => entries.filter(e => ['article', 'fragment'].includes(e.kind));
function shell() {
  document.documentElement.lang = getLanguage() === 'zh' ? 'zh-CN' : 'en';
  document.querySelector('.skip-link').textContent = t('Skip to content', '跳到正文');
  document.querySelector('#site-header').innerHTML = `<a class="brand" href="/" data-nav aria-label="${t('Janus home', 'Janus 首页')}"><img class="brand-coin" src="/assets/janus-coin.png" alt="${t('Pixel silver coin showing the two faces of Janus', '像素风格的双面神 Janus 银币')}" width="112" height="112"><span>Janus</span></a><div class="header-right"><nav class="site-nav" aria-label="${t('Main navigation', '主导航')}"><a href="/writing" data-nav>${t('Writing', '文章')}</a><a href="/projects" data-nav>${t('Projects', '项目')}</a></nav>${languageButton()}</div>`;
  document.querySelector('#site-footer').innerHTML = `<span>Janus <span class="footer-separator">/</span> Hu Xueao</span><a href="/admin">${t('Sign in', '登录后台')}</a>`;
  activeNav();
}
function activeNav() {
  document.querySelectorAll('.site-nav a').forEach(a => {
    const active = a.pathname === location.pathname || (a.pathname === '/projects' && location.pathname.startsWith('/play/'));
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
const errorNote = () => loadError ? `<p class="notice" role="status">${t('Posts could not load. The game is still available.', '文章暂时无法加载，你仍然可以玩游戏。')} <button class="text-button" data-retry>${t('Try again', '重试')}</button></p>` : '';
const emptyWriting = () => `<div class="empty-state"><h3>${t('No posts yet.', '还没有文章。')}</h3><p>${t('New posts will appear here.', '发布后的文章会显示在这里。')}</p></div>`;
const rows = list => list.map(e => `<a class="entry-row" href="${entryLink(e)}" data-nav><h3>${esc(e.title)}</h3>${e.excerpt ? `<p>${esc(e.excerpt)}</p>` : ''}<time datetime="${esc(e.published_at || '')}">${esc(date(e.published_at, getLanguage()))}</time></a>`).join('');
function strataCard() {
  return `<article class="project-feature"><a class="project-art" href="/play/strata" data-nav aria-label="${t('Play Strata', '游玩 Strata')}"><img src="/assets/doorway.png" alt="${t('Pixel landscape with a stone doorway', '像素风格的石门与山野')}" width="1200" height="800"></a><div class="project-copy"><span class="eyebrow">${t('Card game', '卡牌游戏')}</span><h2><a href="/play/strata" data-nav>Strata</a></h2><p>${t('Dig for treasure. Build your crew. Play against the AI.', '挖掘宝藏，组建队伍，与电脑对战。')}</p><a class="button primary" href="/play/strata" data-nav>${t('Play', '开始游戏')}</a></div></article>`;
}
function home() {
  return `<header class="home-heading"><h1>${t('Writing and small projects.', '文章与小作品。')}</h1><p>${t('By Hu Xueao.', 'Hu Xueao 的个人网站。')}</p></header>${errorNote()}<div class="home-grid"><section><div class="section-title"><h2>${t('Projects', '项目')}</h2><a href="/projects" data-nav>${t('View all', '查看全部')}</a></div>${strataCard()}</section><section class="home-writing"><div class="section-title"><h2>${t('Writing', '文章')}</h2><a href="/writing" data-nav>${t('View all', '查看全部')}</a></div>${writing().length ? rows(writing().slice(0, 4)) : emptyWriting()}</section></div>`;
}
function listing() {
  return `<header class="page-heading"><h1>${t('Writing', '文章')}</h1><p>${t('Articles and notes.', '文章与随笔。')}</p></header>${errorNote()}<section class="listing">${writing().length ? rows(writing()) : emptyWriting()}</section>`;
}
function projects() {
  return `<header class="page-heading"><h1>${t('Projects', '项目')}</h1><p>${t('Games and things I build.', '我做的游戏和小工具。')}</p></header>${errorNote()}<div class="project-grid">${strataCard()}${entries.filter(e => e.kind === 'project').map(e => `<article class="project-feature">${e.cover_url ? `<a class="project-art" href="${entryLink(e)}" data-nav><img src="${esc(safeLink(e.cover_url))}" alt="${esc(e.title)}" loading="lazy"></a>` : ''}<div class="project-copy"><h2>${esc(e.title)}</h2><p>${esc(e.excerpt)}</p><a class="button" href="${entryLink(e)}" data-nav>${t('Open project', '打开项目')}</a></div></article>`).join('')}</div>`;
}
function article(slug) {
  const e = entries.find(e => e.slug === slug);
  if (!e) return notFound();
  document.title = `${e.title} — Janus`;
  return `<article class="article"><a class="back-link" href="/${e.kind === 'project' ? 'projects' : 'writing'}" data-nav>${e.kind === 'project' ? t('All projects', '所有项目') : t('All writing', '所有文章')}</a><header><h1>${esc(e.title)}</h1>${e.excerpt ? `<p class="standfirst">${esc(e.excerpt)}</p>` : ''}<time>${esc(date(e.published_at, getLanguage()))}</time></header>${e.cover_url ? `<img class="cover" src="${esc(safeLink(e.cover_url))}" alt="">` : ''}<div class="prose">${markdown(e.body)}</div>${e.demo_url ? `<p class="article-action"><a class="button primary" href="${esc(safeLink(e.demo_url))}" rel="noopener noreferrer">${t('Open project', '打开项目')}</a></p>` : ''}${e.source_url ? `<p class="article-action"><a href="${esc(safeLink(e.source_url))}" rel="noopener noreferrer">${t('View code', '查看代码')}</a></p>` : ''}</article>`;
}
function notFound() { return `<section class="empty-state"><h1>${t('Page not found.', '页面不存在。')}</h1><p><a href="/" data-nav>${t('Go home', '返回首页')}</a></p></section>`; }
async function render({focus = false} = {}) {
  const id = ++renderId;
  gameCleanup?.(); gameCleanup = null;
  let path = location.pathname;
  const oldRoutes = {'/experiments': '/projects', '/index': '/', '/about': '/'};
  if (oldRoutes[path]) { path = oldRoutes[path]; history.replaceState({}, '', path); }
  document.body.classList.toggle('game-page', path === '/play/strata');
  document.title = path === '/play/strata' ? 'Strata — Janus' : 'Janus — Hu Xueao';
  activeNav();
  if (path === '/play/strata') {
    main.innerHTML = `<p class="loading">${t('Loading game…', '正在加载游戏…')}</p>`;
    const { mountGame } = await import('./game/ui.js');
    if (id !== renderId) return;
    gameCleanup = mountGame(main);
  } else main.innerHTML = path === '/' ? home() : path === '/writing' ? listing() : path === '/projects' ? projects() : path.startsWith('/entry/') ? article(decodeURIComponent(path.slice(7))) : notFound();
  if (focus) main.focus({preventScroll: true});
}
async function load() {
  try { const r = await fetch('/api/content', {cache: 'no-store'}); if (!r.ok) throw new Error(); entries = (await r.json()).entries; loadError = false; }
  catch { loadError = true; }
  if (location.pathname !== '/play/strata') await render();
}
document.addEventListener('click', event => {
  const a = event.target.closest('a[data-nav]');
  if (a && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault(); history.pushState({}, '', a.getAttribute('href')); window.scrollTo(0, 0); render({focus: true});
  }
  if (event.target.closest('[data-retry]')) load();
});
window.addEventListener('popstate', () => render({focus: true}));
window.addEventListener('janus:language', () => { shell(); if (location.pathname !== '/play/strata') render(); });
bindLanguageButton(); shell(); mountMascot(document.querySelector('#floating-mascot')); render(); load();
