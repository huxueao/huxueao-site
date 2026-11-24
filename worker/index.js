import { verifyAccess } from './auth.js';
import { flightMarketResponse } from './flight-data.js';

const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicEntry = row => ({ ...row, tags: JSON.parse(row.tags || '[]'), featured: Boolean(row.featured) });
const allowedKinds = ['article', 'project', 'fragment'];
const now = () => new Date().toISOString();

async function readLimited(request, limit = 300_000) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw Object.assign(new Error('This upload is too large.'), { status: 413 }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function safeURL(value, { local = false } = {}) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Please enter a valid URL.');
  if (local && /^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(value)) return value;
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Links must use HTTPS.');
  return u.href;
}

export function validateEntry(data) {
  if (!data || typeof data !== 'object') throw new Error('An entry is required.');
  if (!allowedKinds.includes(data.kind)) throw new Error('Choose an entry type.');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 160) throw new Error('The title must be 1–160 characters.');
  if (typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) || data.slug.length > 120) throw new Error('Use lowercase letters, numbers and hyphens in the slug.');
  if (!['draft', 'published'].includes(data.status)) throw new Error('Choose draft or published.');
  if (typeof data.body !== 'string' || data.body.length > 120_000) throw new Error('The entry is too long.');
  if (typeof data.excerpt !== 'string' || data.excerpt.length > 500) throw new Error('Keep the summary under 500 characters.');
  if (!Array.isArray(data.tags) || data.tags.length > 8 || data.tags.some(t => typeof t !== 'string' || t.length > 32)) throw new Error('Use up to eight short tags.');
  return { ...data, title: data.title.trim(), tags: [...new Set(data.tags.map(t => t.trim()).filter(Boolean))], featured: data.featured ? 1 : 0,
    cover_url: safeURL(data.cover_url, { local: true }), demo_url: safeURL(data.demo_url, { local: true }), source_url: safeURL(data.source_url) };
}

function accessPage(message, status) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Owner access — Janus</title><link rel="stylesheet" href="/style.css"><main class="access-page"><a class="eyebrow" href="/">HUXUEAO.COM</a><h1>Owner access.</h1><p>${escapeHTML(message)}</p><p>Writing and projects are available without signing in.</p><a href="/">Return home</a></main></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

export function createHandler({ authenticate = verifyAccess } = {}) {
  return {
    async fetch(request, env) {
      let response;
      try { response = await dispatch(request, env, authenticate); }
      catch (error) {
        if (!error.status || error.status >= 500) console.error('Request failed:', error.message);
        response = json({ error: error.status ? error.message : 'Something went wrong. Please try again.' }, error.status || 500);
      }
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(security)) headers.set(key, value);
      if (new URL(request.url).protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
      return new Response(response.body, { status: response.status, headers });
    },
  };
}

async function dispatch(request, env, authenticate) {
  const url = new URL(request.url), path = url.pathname;
  if(path==='/api/flight/market')return flightMarketResponse(request,env);
  if (path === '/favicon.ico') return Response.redirect(new URL('/assets/janus-coin.png',url),302);
  const admin = path === '/admin' || path.startsWith('/admin/') || path === '/admin.html' || path.startsWith('/api/admin/');
  let identity;
  if (admin) {
    identity = await authenticate(request, env);
    if (!identity || identity.error) {
      const error = identity || { error: 'Sign in required.', status: 401 };
      return path.startsWith('/api/') ? json({ error: error.error }, error.status) : accessPage(error.error, error.status);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (request.headers.get('origin') !== url.origin) return json({ error: 'This request did not come from the owner workspace.' }, 403);
    }
  }
  if (path === '/api/content' && request.method === 'GET') {
    if (!env.DB) return json({ error: 'The publication is being set up. Please check back shortly.' }, 503);
    const { results } = await env.DB.prepare("SELECT * FROM entries WHERE status = 'published' ORDER BY featured DESC, published_at DESC").all();
    return json({ entries: results.map(publicEntry), preview: env.DEMO_CONTENT === 'true', site: { name: env.SITE_NAME || 'JANUS' } }, 200, { 'Cache-Control': 'no-cache' });
  }
  if (path.startsWith('/media/') && ['GET','HEAD'].includes(request.method)) {
    const id = path.slice(7);
    if (!/^[a-z0-9-]+$/.test(id)) return new Response('Not found', { status: 404 });
    const row = await env.DB?.prepare('SELECT mime_type, bytes FROM media WHERE id = ?').bind(id).first();
    if (!row) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : (Array.isArray(row.bytes) ? new Uint8Array(row.bytes) : row.bytes), { headers: { 'Content-Type': row.mime_type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }
  if (path === '/api/admin/me') return json({ email: identity.email });
  if (path === '/api/admin/entries' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM entries ORDER BY updated_at DESC').all();
    return json({ entries: results.map(publicEntry) });
  }
  if (path === '/api/admin/media' && request.method === 'POST') {
    const bytes = await readLimited(request, 1_000_000);
    const hex = [...bytes.slice(0,12)].map(b => b.toString(16).padStart(2,'0')).join('');
    let mime;
    if (hex.startsWith('89504e470d0a1a0a')) mime = 'image/png';
    else if (hex.startsWith('ffd8ff')) mime = 'image/jpeg';
    else if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) mime = 'image/gif';
    else if (hex.startsWith('52494646') && hex.slice(16) === '57454250') mime = 'image/webp';
    else return json({ error: 'Use a PNG, JPEG, GIF or WebP image.' }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO media (id,mime_type,bytes,created_at) VALUES (?,?,?,?)').bind(id,mime,bytes.buffer,now()).run();
    return json({ url: `/media/${id}` }, 201);
  }
  if (path === '/api/admin/entries' && request.method === 'POST') {
    let data;
    try { data = validateEntry(JSON.parse(new TextDecoder().decode(await readLimited(request)))); }
    catch (e) { return json({ error: e.message }, e.status || 400); }
    const id = crypto.randomUUID(), timestamp = now();
    const existing = await env.DB.prepare('SELECT id FROM entries WHERE slug = ?').bind(data.slug).first();
    if (existing) return json({ error: 'That URL slug is already in use.' }, 409);
    await env.DB.prepare('INSERT INTO entries (id,kind,slug,title,excerpt,body,tags,status,featured,cover_url,demo_url,source_url,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,data.kind,data.slug,data.title,data.excerpt,data.body,JSON.stringify(data.tags),data.status,data.featured,data.cover_url,data.demo_url,data.source_url,timestamp,timestamp,data.status === 'published' ? timestamp : null).run();
    return json({ entry: publicEntry(await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first()) }, 201);
  }
  const entryMatch = path.match(/^\/api\/admin\/entries\/([a-zA-Z0-9-]+)$/);
  if (entryMatch && request.method === 'PUT') {
    const id = entryMatch[1]; let data;
    try { data = validateEntry(JSON.parse(new TextDecoder().decode(await readLimited(request)))); }
    catch (e) { return json({ error: e.message }, e.status || 400); }
    if (typeof data.updated_at !== 'string') return json({ error: 'Reload this entry before saving.' }, 409);
    const previous = await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first();
    if (!previous) return json({ error: 'Entry not found.' }, 404);
    const duplicate = await env.DB.prepare('SELECT id FROM entries WHERE slug = ? AND id != ?').bind(data.slug,id).first();
    if (duplicate) return json({ error: 'That URL slug is already in use.' }, 409);
    const timestamp = new Date(Math.max(Date.now(), Date.parse(previous.updated_at) + 1)).toISOString();
    const result = await env.DB.prepare('UPDATE entries SET kind=?,slug=?,title=?,excerpt=?,body=?,tags=?,status=?,featured=?,cover_url=?,demo_url=?,source_url=?,updated_at=?,published_at=? WHERE id=? AND updated_at=?')
      .bind(data.kind,data.slug,data.title,data.excerpt,data.body,JSON.stringify(data.tags),data.status,data.featured,data.cover_url,data.demo_url,data.source_url,timestamp,data.status === 'published' ? (previous.published_at || timestamp) : previous.published_at,id,data.updated_at).run();
    if (!result.meta.changes) return json({ error: 'This entry changed in another tab. Reload it before saving.' }, 409);
    return json({ entry: publicEntry(await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first()) });
  }
  if (path.startsWith('/api/')) return json({ error: 'Endpoint not found.' }, 404);
  if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n', { headers: { 'Content-Type': 'text/plain' } });
  if (path === '/sitemap.xml') {
    const base = env.SITE_URL || url.origin;
    const { results = [] } = env.DB ? await env.DB.prepare("SELECT kind,slug,updated_at FROM entries WHERE status='published'").all() : {};
    const paths = ['/', '/writing', '/projects', '/play/strata', '/play/candle-flight'].map(p => `<url><loc>${escapeHTML(base + p)}</loc></url>`);
    for (const row of results) paths.push(`<url><loc>${escapeHTML(base + '/entry/' + row.slug)}</loc><lastmod>${row.updated_at.slice(0,10)}</lastmod></url>`);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
  }
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (admin) return env.ASSETS.fetch(new Request(new URL('/admin',url), request));
  const redirects = {'/experiments':'/projects','/index':'/','/about':'/'};
  if (redirects[path]) return new Response(null,{status:308,headers:{Location:redirects[path]}});
  const routes = ['/', '/writing','/projects'];
  if (routes.includes(path) || path.startsWith('/entry/') || path.startsWith('/play/')) {
    let title = 'Janus - Hu Xueao', description = 'Writing, projects, and games by Hu Xueao.';
    if (path.startsWith('/entry/')) {
      const row = await env.DB?.prepare("SELECT title,excerpt FROM entries WHERE slug=? AND status='published'").bind(path.slice(7)).first();
      if (!row) return accessPage('This page has not been published, or has moved.',404);
      title = `${row.title} — Janus`; description = row.excerpt;
    }
    const asset = await env.ASSETS.fetch(new Request(new URL('/',url), request));
    if (!asset.ok) return asset;
    let html = await asset.text();
    html = html.replace('<!--PAGE_TITLE-->',escapeHTML(title)).replace('<!--PAGE_DESCRIPTION-->',escapeHTML(description));
    return new Response(request.method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
  return env.ASSETS.fetch(request);
}

export default createHandler();
