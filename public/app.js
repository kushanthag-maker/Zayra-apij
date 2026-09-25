/* ZAYRA API HUB — frontend (vanilla JS SPA, hash routing) */
(() => {
  // When previewed on a proxy, __PORT_3000__ gets rewritten to the backend URL. On Vercel it stays as-is → same origin.
  const PORT_PLACEHOLDER = '__PORT_3000__';
  const API = PORT_PLACEHOLDER.startsWith('__') ? '' : PORT_PLACEHOLDER;
  const BASE_URL = API || location.origin;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
  const ago = (iso) => {
    if (!iso) return 'never';
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const fmtBytes = (b) => { b = Number(b || 0); if (b < 1024) return b + ' B'; const u = ['KB', 'MB', 'GB', 'TB']; let i = -1; do { b /= 1024; i++; } while (b >= 1024 && i < 3); return b.toFixed(b >= 10 ? 1 : 2) + ' ' + u[i]; };
  const EXPIRES = [['3600', '1 hour'], ['21600', '6 hours'], ['43200', '12 hours'], ['86400', '24 hours'], ['172800', '48 hours'], ['0', 'Never']];

  // ---------- state ----------
  let token = null, me = null, catalog = null, charts = [];
  try { token = localStorage.getItem('zayra_token'); } catch (_) {}
  const saveToken = (t) => { token = t; try { t ? localStorage.setItem('zayra_token', t) : localStorage.removeItem('zayra_token'); } catch (_) {} };

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token && !opts.noAuth) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(API + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data; try { data = await r.json(); } catch { data = { success: false, error: 'Invalid response' }; }
    if (r.status === 401 && token && !path.startsWith('/api/v1')) { saveToken(null); me = null; }
    if (!r.ok) { const e = new Error(data.error || 'Request failed'); e.status = r.status; e.data = data; throw e; }
    return data;
  }
  async function getCatalog() { if (!catalog) catalog = (await api('/api/v1/catalog', { noAuth: true })).endpoints; return catalog; }

  function toast(msg, isErr) {
    const t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err-t' : ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function copy(text, label = 'Copied') {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(label)).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(label); } catch { toast('Copy failed', true); } ta.remove();
    });
  }
  function modal(html, onMount) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg); onMount && onMount(bg, () => bg.remove());
    const f = $('input, button', bg); f && f.focus();
  }
  function jsonHL(obj) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    return esc(s).replace(/(&quot;(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\&])*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (m, str, colon, bool) => {
      if (str) return colon ? `<span class="j-k">${str}</span>${colon}` : `<span class="j-s">${str}</span>`;
      if (bool) return `<span class="j-b">${m}</span>`;
      if (m === 'null') return `<span class="j-null">${m}</span>`;
      return `<span class="j-n">${m}</span>`;
    });
  }

  // ---------- icons ----------
  const I = {
    logo: `<svg viewBox="0 0 32 32" fill="none" aria-label="ZAYRA logo"><path d="M16 2.8 27.4 9.4v13.2L16 29.2 4.6 22.6V9.4Z" stroke="currentColor" stroke-width="1.8"/><path d="M11 11h10L11 21h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="2.8" r="1.6" fill="currentColor"/><circle cx="27.4" cy="22.6" r="1.6" fill="currentColor"/><circle cx="4.6" cy="22.6" r="1.6" fill="currentColor"/></svg>`,
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M16 7l3 3M19 4l2 2"/></svg>',
    flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    dragon: '<svg viewBox="0 0 64 64" fill="none"><path d="M32 6C28 14 18 18 12 22C8 28 10 38 16 44C14 48 12 52 14 56C20 54 26 50 32 46C38 50 44 54 50 56C52 52 50 48 48 44C54 38 56 28 52 22C46 18 36 14 32 6Z" fill="#ff2d2d" opacity="0.9"/><path d="M32 14C30 20 24 23 20 26C18 30 19 36 23 40C22 43 21 46 22 48C26 47 30 44 32 42C34 44 38 47 42 48C43 46 42 43 41 40C45 36 46 30 44 26C40 23 34 20 32 14Z" fill="#07070c"/><circle cx="26" cy="30" r="2.5" fill="#ff2d2d"/><circle cx="38" cy="30" r="2.5" fill="#ff2d2d"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-5-6.7"/></svg>',
  };

  // ---------- router ----------
  const routes = {
    '': viewLanding, login: viewLogin, register: viewRegister,
    dashboard: viewDashboard, keys: viewKeys, tester: viewTester, docs: viewDocs,
    history: viewHistory, profile: viewProfile, admin: viewAdmin, files: viewFiles,
  };
  const PROTECTED = ['dashboard', 'keys', 'tester', 'history', 'profile', 'admin', 'files'];

  async function router() {
    charts.forEach((c) => c.destroy()); charts = [];
    const [name, query] = location.hash.replace(/^#\/?/, '').split('?');
    const params = Object.fromEntries(new URLSearchParams(query || ''));
    if (token && !me) { try { me = (await api('/api/me')).user; } catch { saveToken(null); me = null; } }
    if (PROTECTED.includes(name) && !me) return go('login');
    if ((name === 'login' || name === 'register') && me) return go('dashboard');
    if (name === 'admin' && me.role !== 'admin') return go('dashboard');
    const view = routes[name] || viewLanding;
    window.scrollTo(0, 0);
    try { await view(params); } catch (e) { console.error(e); toast(e.message, true); }
  }
  const go = (r) => { location.hash = '#/' + r; };
  window.addEventListener('hashchange', router);

  async function refreshMe() { try { me = (await api('/api/me')).user; const c = $('#side-credits'); if (c) c.textContent = fmtN(me.credits); } catch (_) {} }

  // ---------- layout ----------
  function shell(active, content) {
    const nav = [
      ['dashboard', 'Dashboard', I.grid], ['keys', 'API Keys', I.key], ['files', 'File Hosting', I.upload], ['tester', 'API Tester', I.flask],
      ['docs', 'Documentation', I.book], ['history', 'Request History', I.clock], ['profile', 'Profile', I.user],
    ];
    app.innerHTML = `
      <div class="shell">
        <div class="scrim" id="scrim"></div>
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="#/">${I.logo}<div>ZAYRA<small>API HUB</small></div></a>
          <nav class="nav-group" aria-label="Main">
            <div class="nav-label">Workspace</div>
            ${nav.map(([r, l, ic]) => `<a class="nav-item ${active === r ? 'active' : ''}" href="#/${r}">${ic}${l}</a>`).join('')}
            ${me.role === 'admin' ? `<div class="nav-label">Admin</div><a class="nav-item admin-link ${active === 'admin' ? 'active' : ''}" href="#/admin">${I.shield}Admin Panel</a>` : ''}
          </nav>
          <div class="side-foot">
            <div class="credit-pill"><div class="lbl">CREDITS</div><b id="side-credits">${fmtN(me.credits)}</b><a href="#/dashboard" class="small">Claim free daily credits →</a></div>
            <div class="user-chip">
              <div class="avatar">${esc((me.displayName || me.username)[0].toUpperCase())}</div>
              <div style="min-width:0"><div class="nm">${esc(me.displayName || me.username)}</div><div class="rl">@${esc(me.username)}${me.role === 'admin' ? ' · admin' : ''}</div></div>
              <button class="btn btn-ghost btn-sm" id="logout" aria-label="Log out" title="Log out">${I.logout}</button>
            </div>
          </div>
        </aside>
        <div class="main">
          <div class="mobile-top"><button class="btn btn-ghost btn-sm" id="menu-btn" aria-label="Open menu">${I.menu}</button><a class="brand" href="#/">${I.logo}ZAYRA</a><span class="tag" style="color:var(--gold)">${fmtN(me.credits)} cr</span></div>
          <main class="page">${content}</main>
        </div>
      </div>`;
    $('#logout').onclick = () => { saveToken(null); me = null; toast('Logged out'); go(''); };
    const sb = $('#sidebar'), sc = $('#scrim');
    $('#menu-btn').onclick = () => { sb.classList.add('open'); sc.classList.add('show'); };
    sc.onclick = () => { sb.classList.remove('open'); sc.classList.remove('show'); };
  }
  function publicWrap(content) {
    app.innerHTML = `
      <header class="topnav">
        <a class="brand" href="#/">${I.logo}<div>ZAYRA<small>API HUB</small></div></a>
        <div class="links">
          <a class="btn btn-ghost hide-sm" href="#/docs">Docs</a>
          ${me ? `<a class="btn btn-primary" href="#/dashboard">Dashboard</a>` : `<a class="btn btn-ghost" href="#/login">Log in</a><a class="btn btn-primary" href="#/register">Get API key</a>`}
        </div>
      </header>${content}
      <footer class="footer"><div class="in"><span>© ${new Date().getFullYear()} ZAYRA API HUB · Made in Sri Lanka</span><span class="mono small">v1.0 · REST · JSON</span></div></footer>`;
  }

  // ---------- LANDING ----------
  async function viewLanding() {
    const feats = [
      [I.key, 'API Key generator', 'Create up to 10 keys, name them and revoke anytime.'],
      [I.flask, 'Online API tester', 'Send GET/POST/PUT/DELETE with headers & JSON body.'],
      [I.chart, 'Usage dashboard', 'Daily requests, top endpoints and credit balance.'],
      [I.coin, 'Free credits', '100 credits on signup, +25 free credits every day.'],
      [I.book, 'Interactive docs', 'Try every endpoint from the docs with code snippets.'],
      [I.bolt, 'REST endpoints', 'Sri Lanka data, NIC decoder, phone validator and dev tools.'],
      [I.upload, 'File Hosting API', 'Powered by Dragon Hosting — upload files and get download + short links.'],
      [I.clock, 'Request history', 'Every call logged with status, latency & response.'],
      [I.shield, 'Admin dashboard', 'Manage users, credits, bans and platform analytics.'],
    ];
    publicWrap(`
      <section class="hero">
        <div>
          <span class="eyebrow"><span class="dot"></span>LIVE · REST API PLATFORM</span>
          <h1>Every API a <span class="hl">Sri Lankan dev</span> needs — <span class="gold">in one hub.</span></h1>
          <p class="lead">Generate a key, test endpoints in your browser, and watch your usage in real time. Free credits every day.</p>
          <p class="si" lang="si" style="font-family:'Noto Sans Sinhala',var(--font-body)">ශ්‍රී ලාංකික developersලාට APIs එකම තැනකින් test කරලා use කරන්න පුළුවන් platform එක.</p>
          <div class="cta">
            <a class="btn btn-primary btn-lg" href="#/${me ? 'dashboard' : 'register'}">${I.key} ${me ? 'Open dashboard' : 'Get free API key'}</a>
            <a class="btn btn-lg" href="#/docs">${I.book} Read the docs</a>
          </div>
        </div>
        <div class="terminal" aria-label="Example API request">
          <div class="bar"><i></i><i></i><i></i><span>zsh — curl</span></div>
          <pre id="term"></pre>
        </div>
      </section>
      <section class="section" style="padding-top:1rem">
        <div class="stats-strip">
          <div><b id="st-eps">14</b><span>Live endpoints</span></div>
          <div><b>100</b><span>Signup credits</span></div>
          <div><b>+25</b><span>Free credits / day</span></div>
          <div><b>JSON</b><span>REST responses</span></div>
        </div>
      </section>
      <section class="section">
        <div class="section-head"><div><div class="kicker">// Platform</div><h2>Built for shipping, not signing forms.</h2></div><p>Everything from key generation to analytics — one dark, fast, mobile-friendly console.</p></div>
        <div class="feat-grid">${feats.map(([ic, t, d]) => `<div class="feat"><div class="ic">${ic}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
      </section>
      <section class="section">
        <div class="section-head"><div><div class="kicker">// Endpoints</div><h2>Ready-to-use APIs</h2></div><a class="btn" href="#/docs">Full documentation →</a></div>
        <div class="ep-list" id="ep-list">${'<div class="ep-row"><div class="skeleton" style="width:100%"></div></div>'.repeat(6)}</div>
      </section>`);
    // typewriter terminal
    const lines = [
      `<span class="t-c"># Decode a Sri Lankan NIC</span>`,
      `<span class="t-k">$</span> curl "/api/v1/lk/nic?nic=200012345678" \\`,
      `    -H <span class="t-s">"x-api-key: zk_live_••••••••"</span>`,
      ``,
      `{`,
      `  <span class="t-n">"success"</span>: <span class="t-p">true</span>,`,
      `  <span class="t-n">"data"</span>: {`,
      `    <span class="t-n">"birthday"</span>: <span class="t-s">"2000-05-02"</span>,`,
      `    <span class="t-n">"gender"</span>: <span class="t-s">"Male"</span>,`,
      `    <span class="t-n">"format"</span>: <span class="t-s">"new"</span>`,
      `  }`,
      `}`,
    ];
    const term = $('#term'); let i = 0;
    const tick = () => { if (!term.isConnected) return; if (i <= lines.length) { term.innerHTML = lines.slice(0, i).join('\n') + (i < lines.length ? '\n' : '') + '<span class="cursor"></span>'; i++; setTimeout(tick, i < 4 ? 380 : 120); } };
    tick();
    try {
      const eps = await getCatalog();
      $('#st-eps') && ($('#st-eps').textContent = eps.length);
      $('#ep-list').innerHTML = eps.map((e) => `<div class="ep-row"><span class="m m-${e.method}">${e.method}</span><code>${esc(e.path)}</code><span class="d">${esc(e.title)}</span></div>`).join('');
    } catch { $('#ep-list').innerHTML = `<div class="empty">Could not load endpoints.</div>`; }
  }

  // ---------- AUTH ----------
  function authLayout(inner) {
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-side">
          <a class="brand" href="#/">${I.logo}<div>ZAYRA<small>API HUB</small></div></a>
          <div><div class="kicker">// ayubowan, developer</div><h2>Build faster with<br><span>one key</span> for every API.</h2>
          <p class="muted" style="margin-top:1rem;max-width:26rem">Free credits, live tester, request history and analytics — all in one console.</p></div>
          <span class="mono small muted">zk_live_•••• · 1 credit / request</span>
          <div class="big-logo">${I.logo}</div>
        </div>
        <div class="auth-main"><div class="auth-card">${inner}</div></div>
      </div>`;
  }
  function pwToggle() { $$('.pw-wrap button').forEach((b) => (b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; })); }

  function viewLogin() {
    authLayout(`
      <a class="brand" href="#/" style="margin-bottom:2rem">${I.logo}<div>ZAYRA<small>API HUB</small></div></a>
      <h1>Welcome back</h1><p class="sub">Log in to your developer console.</p>
      <form id="f">
        <div class="err" id="err"></div>
        <div class="field"><label for="u">Username</label><input class="input" id="u" autocomplete="username" required placeholder="your_username"></div>
        <div class="field"><label for="p">Password</label><div class="pw-wrap"><input class="input" id="p" type="password" autocomplete="current-password" required placeholder="••••••••"><button type="button" class="btn btn-ghost btn-sm" aria-label="Show password">${I.eye}</button></div></div>
        <button class="btn btn-primary btn-lg" type="submit">Log in</button>
      </form>
      <p class="alt">New here? <a href="#/register">Create a free account</a></p>`);
    pwToggle();
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); btn.disabled = true; btn.textContent = 'Logging in…';
      try {
        const r = await api('/api/auth/login', { method: 'POST', body: { username: $('#u').value, password: $('#p').value }, noAuth: true });
        saveToken(r.token); me = r.user; toast('Welcome, ' + (me.displayName || me.username)); go(me.role === 'admin' ? 'admin' : 'dashboard');
      } catch (err) { $('#err').textContent = err.message; $('#err').classList.add('show'); btn.disabled = false; btn.textContent = 'Log in'; }
    };
  }
  function viewRegister() {
    authLayout(`
      <a class="brand" href="#/" style="margin-bottom:2rem">${I.logo}<div>ZAYRA<small>API HUB</small></div></a>
      <h1>Create account</h1><p class="sub">Get 100 free credits instantly.</p>
      <form id="f">
        <div class="err" id="err"></div>
        <div class="field"><label for="u">Username</label><input class="input" id="u" autocomplete="username" required placeholder="a-z, 0-9, _ (3-20)" pattern="[a-zA-Z0-9_]{3,20}"></div>
        <div class="field"><label for="n">Display name</label><input class="input" id="n" placeholder="Kasun Perera"></div>
        <div class="field"><label for="em">Email (optional)</label><input class="input" id="em" type="email" placeholder="you@example.lk"></div>
        <div class="field"><label for="p">Password</label><div class="pw-wrap"><input class="input" id="p" type="password" autocomplete="new-password" required minlength="6" placeholder="Min 6 characters"><button type="button" class="btn btn-ghost btn-sm" aria-label="Show password">${I.eye}</button></div></div>
        <button class="btn btn-primary btn-lg" type="submit">Create account</button>
      </form>
      <p class="alt">Already have an account? <a href="#/login">Log in</a></p>`);
    pwToggle();
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); btn.disabled = true;
      try {
        const r = await api('/api/auth/register', { method: 'POST', body: { username: $('#u').value.toLowerCase(), displayName: $('#n').value, email: $('#em').value, password: $('#p').value }, noAuth: true });
        saveToken(r.token); me = r.user; toast('Account created · 100 free credits added'); go('keys');
      } catch (err) { $('#err').textContent = err.message; $('#err').classList.add('show'); btn.disabled = false; }
    };
  }

  // ---------- charts ----------
  function lastNDays(n) {
    const out = []; const base = Date.now() + 5.5 * 3600e3;
    for (let i = n - 1; i >= 0; i--) out.push(new Date(base - i * 864e5).toISOString().slice(0, 10));
    return out;
  }
  function lineChart(canvas, labels, data, color = '#2ef2c0') {
    if (!window.Chart) return;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 240);
    g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
    charts.push(new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor: color, backgroundColor: g, fill: true, tension: .35, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: color }] },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#131a24', borderColor: '#26334a', borderWidth: 1, titleFont: { family: 'JetBrains Mono' }, bodyFont: { family: 'JetBrains Mono' } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4b5868', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 7 } },
          y: { beginAtZero: true, grid: { color: '#1c2633' }, border: { display: false }, ticks: { color: '#4b5868', font: { family: 'JetBrains Mono', size: 10 }, precision: 0 } },
        },
      },
    }));
  }
  function doughnut(canvas, labels, data) {
    if (!window.Chart) return;
    charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#54e38e', '#f5b53d', '#ff5d73', '#5ab4ff'], borderColor: '#0e131b', borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#7d8b9c', font: { family: 'JetBrains Mono', size: 11 }, boxWidth: 10 } } } },
    }));
  }
  const waitChart = () => new Promise((r) => { if (window.Chart) return r(); const t = setInterval(() => { if (window.Chart) { clearInterval(t); r(); } }, 50); setTimeout(() => { clearInterval(t); r(); }, 4000); });
  function barList(obj, limit = 6) {
    const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit);
    if (!e.length) return `<div class="empty">No requests yet.</div>`;
    const max = e[0][1];
    return `<div class="bar-list">${e.map(([k, v]) => `<div class="bar-item"><div class="top"><code>${esc(k.replace('/api/v1', ''))}</code><span class="mono muted">${fmtN(v)}</span></div><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div></div>`).join('')}</div>`;
  }
  function statusCell(s) { return `<span class="st st-${String(s)[0]}">${s}</span>`; }

  // ---------- DASHBOARD ----------
  async function viewDashboard() {
    shell('dashboard', `<div class="page-head"><div><h1>Dashboard</h1><p>Ayubowan, ${esc(me.displayName || me.username)} — here's your API activity.</p></div><a class="btn btn-primary" href="#/tester">${I.flask} Open API tester</a></div><div id="dash"><div class="grid g-4">${'<div class="card"><div class="skeleton" style="width:50%"></div><div class="skeleton" style="height:30px;margin-top:12px"></div></div>'.repeat(4)}</div></div>`);
    const [u] = await Promise.all([api('/api/usage'), waitChart()]);
    const days = lastNDays(14);
    const todayKey = days[days.length - 1];
    const activeKeys = me.keys.filter((k) => !k.revoked).length;
    const ok = u.history.filter((h) => h.status < 400).length;
    const avg = u.history.length ? Math.round(u.history.reduce((a, h) => a + (h.ms || 0), 0) / u.history.length) : 0;
    const claimed = u.lastClaim === todayKey;
    $('#dash').innerHTML = `
      <div class="grid g-4">
        <div class="card kpi gold"><div class="lbl">${I.coin} Credits left</div><div class="val" id="kpi-credits">${fmtN(u.credits)}</div><div class="sub">1 credit per successful call</div></div>
        <div class="card kpi accent"><div class="lbl">${I.bolt} Total requests</div><div class="val">${fmtN(u.totalRequests)}</div><div class="sub">${fmtN(u.daily[todayKey] || 0)} today</div></div>
        <div class="card kpi"><div class="lbl">${I.key} Active keys</div><div class="val">${activeKeys}</div><div class="sub">max 10</div></div>
        <div class="card kpi"><div class="lbl">${I.clock} Avg latency</div><div class="val">${avg}<span style="font-size:1rem" class="muted">ms</span></div><div class="sub">${u.history.length ? Math.round((ok / u.history.length) * 100) : 100}% success rate</div></div>
      </div>
      <div class="grid g-21 mt">
        <div class="card"><div class="card-head"><h3>Requests · last 14 days</h3><span class="hint mono">Asia/Colombo</span></div><div class="chart-box"><canvas id="c1"></canvas></div></div>
        <div class="card claim-card">
          <div class="card-head"><h3>Free daily credits</h3>${I.gift}</div>
          <p class="muted small" style="margin-bottom:1rem">Claim <b style="color:var(--gold)">+${u.dailyCredits} credits</b> every day for free. Resets at midnight Sri Lanka time.</p>
          <button class="btn btn-gold btn-lg" style="width:100%" id="claim" ${claimed ? 'disabled' : ''}>${claimed ? 'Claimed today ✓' : `Claim +${u.dailyCredits} credits`}</button>
          <div class="mt small muted">Tip: Need more? Ask the admin for a credit top-up.</div>
        </div>
      </div>
      <div class="grid g-2 mt">
        <div class="card"><div class="card-head"><h3>Top endpoints</h3><a class="small" href="#/docs">Docs →</a></div>${barList(u.endpoints)}</div>
        <div class="card"><div class="card-head"><h3>Recent requests</h3><a class="small" href="#/history">View all →</a></div>
          ${u.history.length ? `<div class="table-wrap"><table><thead><tr><th>Status</th><th>Endpoint</th><th>Time</th><th>When</th></tr></thead><tbody>${u.history.slice(0, 6).map((h) => `<tr><td>${statusCell(h.status)}</td><td><code>${esc(h.endpoint.replace('/api', ''))}</code></td><td class="mono muted">${h.ms}ms</td><td class="muted small">${ago(h.at)}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty">${I.flask}<div>No requests yet. <a href="#/keys">Create a key</a> and try the <a href="#/tester">tester</a>.</div></div>`}
        </div>
      </div>`;
    lineChart($('#c1'), days.map((d) => d.slice(5)), days.map((d) => u.daily[d] || 0));
    $('#claim').onclick = async (e) => {
      e.target.disabled = true;
      try { const r = await api('/api/credits/claim', { method: 'POST' }); toast(`+${r.added} credits added`); $('#kpi-credits').textContent = fmtN(r.credits); e.target.textContent = 'Claimed today ✓'; refreshMe(); }
      catch (err) { toast(err.message, true); }
    };
  }

  // ---------- KEYS ----------
  async function viewKeys(params, newKey) {
    await refreshMe();
    shell('keys', `
      <div class="page-head"><div><h1>API Keys</h1><p>Send your key in the <code class="mono">x-api-key</code> header. Keep it secret.</p></div><button class="btn btn-primary" id="new">${I.plus} Generate new key</button></div>
      ${newKey ? `<div class="new-key-banner"><p><b>Your new key is ready.</b> Copy it now and store it safely.</p><div class="row"><div class="key-val" style="flex:1"><span>${esc(newKey.key)}</span></div><button class="btn btn-primary btn-sm" data-copy="${esc(newKey.key)}">${I.copy} Copy</button><a class="btn btn-sm" href="#/tester">Test it →</a></div></div>` : ''}
      <div class="card">
        ${me.keys.length ? me.keys.map((k) => `
          <div class="key-row ${k.revoked ? 'revoked' : ''}">
            <div class="info"><div class="nm">${esc(k.name)} ${k.revoked ? '<span class="tag banned">revoked</span>' : '<span class="tag active">active</span>'}</div>
              <div class="meta mono">created ${fmtDate(k.createdAt)} · last used ${ago(k.lastUsed)} · ${fmtN(k.requests)} req</div></div>
            <div class="key-val" style="max-width:360px;flex:1"><span data-full="${esc(k.key)}">${esc(k.key.slice(0, 14))}••••••••••••${esc(k.key.slice(-4))}</span></div>
            ${k.revoked ? '' : `<div class="row"><button class="btn btn-sm" data-copy="${esc(k.key)}">${I.copy} Copy</button><button class="btn btn-sm" data-reveal>${I.eye}</button><button class="btn btn-danger btn-sm" data-revoke="${k.id}">Revoke</button></div>`}
          </div>`).join('') : `<div class="empty">${I.key}<div>No API keys yet. Generate one to start calling endpoints.</div></div>`}
      </div>
      <div class="card mt"><div class="card-head"><h3>Quick start</h3></div>
        <pre class="code wrap">curl "${esc(BASE_URL)}/api/v1/ping" \\\n  -H "x-api-key: YOUR_API_KEY"</pre></div>`);
    $$('[data-copy]').forEach((b) => (b.onclick = () => copy(b.dataset.copy, 'API key copied')));
    $$('[data-reveal]').forEach((b) => (b.onclick = () => { const s = $('[data-full]', b.closest('.key-row')); const full = s.dataset.full; s.textContent = s.textContent === full ? full.slice(0, 14) + '••••••••••••' + full.slice(-4) : full; }));
    $$('[data-revoke]').forEach((b) => (b.onclick = () => modal(`<h3>Revoke this key?</h3><p class="muted small">Apps using this key will immediately stop working. This cannot be undone.</p><div class="actions"><button class="btn" data-x>Cancel</button><button class="btn btn-danger" data-ok>Revoke key</button></div>`, (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = async () => { try { await api('/api/keys?id=' + b.dataset.revoke, { method: 'DELETE' }); close(); toast('Key revoked'); viewKeys(); } catch (e) { toast(e.message, true); } };
    })));
    $('#new').onclick = () => modal(`<h3>Generate API key</h3><div class="field"><label for="kn">Key name</label><input class="input" id="kn" placeholder="e.g. My Laravel app" maxlength="40"></div><div class="actions"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok>Generate</button></div>`, (m, close) => {
      $('[data-x]', m).onclick = close;
      const submit = async () => { try { const r = await api('/api/keys', { method: 'POST', body: { name: $('#kn', m).value || 'My key' } }); close(); toast('New API key generated'); viewKeys({}, r.key); } catch (e) { toast(e.message, true); } };
      $('[data-ok]', m).onclick = submit; $('#kn', m).onkeydown = (e) => e.key === 'Enter' && submit();
    });
  }

  // ---------- TESTER ----------
  async function viewTester(params) {
    await refreshMe();
    const eps = await getCatalog();
    const keys = me.keys.filter((k) => !k.revoked);
    shell('tester', `
      <div class="page-head"><div><h1>API Tester</h1><p>Send live requests — every call is logged in your history.</p></div></div>
      ${keys.length ? '' : `<div class="new-key-banner"><p>You need an API key to call endpoints.</p><a class="btn btn-primary btn-sm" href="#/keys">${I.key} Generate a key</a></div>`}
      <div class="grid" style="grid-template-columns:260px 1fr" id="tgrid">
        <div class="card" style="padding:.8rem"><div class="nav-label" style="padding-top:.2rem">Endpoints</div><div class="quick-eps">${eps.map((e, i) => `<button class="quick-ep" data-i="${i}"><span class="m m-${e.method}">${e.method}</span><span class="t">${esc(e.title)}</span></button>`).join('')}</div></div>
        <div style="min-width:0;display:flex;flex-direction:column;gap:1rem">
          <div class="card">
            <div class="tester-bar">
              <select class="select" id="method">${['GET', 'POST', 'PUT', 'DELETE'].map((m) => `<option>${m}</option>`).join('')}</select>
              <input class="input mono" id="url" value="${esc(BASE_URL)}/api/v1/ping" aria-label="Request URL">
              <button class="btn btn-primary" id="send">${I.send} Send</button>
            </div>
            <div class="row mt" style="gap:.4rem;flex-wrap:wrap"><button class="btn btn-sm" id="cp-url">${I.copy} Copy URL</button><button class="btn btn-sm btn-primary" id="cp-urlkey">${I.key} Copy URL + key</button></div>
            <div class="field mt"><label for="key">API key</label><select class="select mono" id="key">${keys.map((k) => `<option value="${esc(k.key)}">${esc(k.name)} — ${esc(k.key.slice(0, 16))}…</option>`).join('')}<option value="">(no key)</option></select></div>
            <div class="tabs mt" role="tablist"><button class="tab active" data-tab="params">Query params</button><button class="tab" data-tab="headers">Headers</button><button class="tab" data-tab="body">Body (JSON)</button><button class="tab" data-tab="file" id="file-tab" hidden>File (multipart)</button><button class="tab" data-tab="code">Code snippet</button></div>
            <div data-pane="params"><div id="qp"></div><button class="btn btn-sm" id="add-qp">${I.plus} Add param</button></div>
            <div data-pane="headers" hidden><div id="hd"></div><button class="btn btn-sm" id="add-hd">${I.plus} Add header</button></div>
            <div data-pane="body" hidden><textarea class="textarea" id="body" placeholder='{ "key": "value" }'></textarea></div>
            <div data-pane="file" hidden><div class="field"><label for="tfile">file</label><input class="input" type="file" id="tfile"></div><div class="field mt"><label for="texp">expire</label><select class="select" id="texp">${EXPIRES.map(([v, l]) => `<option value="${v}" ${v === '86400' ? 'selected' : ''}>${l}</option>`).join('')}</select></div><p class="small muted mt">Sent as multipart/form-data. Max ${'4'} MB.</p></div>
            <div data-pane="code" hidden><pre class="code wrap" id="snippet"></pre><button class="btn btn-sm mt" id="copy-snip">${I.copy} Copy</button></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Response</h3><div class="row" style="gap:.6rem"><div class="resp-meta" id="meta"><span>Press Send to run a request</span></div><button class="btn btn-ghost btn-sm" id="cp-resp" title="Copy response">${I.copy} Copy</button></div></div>
            <pre class="code" id="resp"><span class="j-null">// response will appear here</span></pre>
          </div>
        </div>
      </div>`);
    if (window.matchMedia('(max-width: 880px)').matches) $('#tgrid').style.gridTemplateColumns = '1fr';
    const kvRow = (wrap, k = '', v = '') => {
      const d = document.createElement('div'); d.className = 'kv-row';
      d.innerHTML = `<input class="input mono" placeholder="key" value="${esc(k)}"><input class="input mono" placeholder="value" value="${esc(v)}"><button class="btn btn-ghost btn-sm" aria-label="Remove">${I.x}</button>`;
      $('button', d).onclick = () => { d.remove(); syncUrl(); snippet(); };
      $$('input', d).forEach((i) => (i.oninput = () => { syncUrl(); snippet(); }));
      wrap.appendChild(d);
    };
    const readKV = (wrap) => $$('.kv-row', wrap).map((r) => $$('input', r).map((i) => i.value)).filter(([k]) => k);
    const syncUrl = () => {
      const u = $('#url').value.split('?')[0];
      const qs = new URLSearchParams(readKV($('#qp'))).toString();
      $('#url').value = u + (qs ? '?' + qs : '');
    };
    function snippet() {
      const m = $('#method').value, url = $('#url').value, key = $('#key').value;
      const hdrs = readKV($('#hd')); const body = $('#body').value.trim();
      let c = `curl -X ${m} "${url}"`;
      if (key) c += ` \\\n  -H "x-api-key: ${key}"`;
      hdrs.forEach(([k, v]) => (c += ` \\\n  -H "${k}: ${v}"`));
      if (multipart) { c += ` \\\n  -F "file=@${$('#tfile').files[0]?.name || 'image.png'}" \\\n  -F "expire=${$('#texp').value}"`; $('#snippet').textContent = c + `\n\n// JavaScript (fetch)\nconst form = new FormData();\nform.append("file", fileInput.files[0]);\nform.append("expire", "${$('#texp').value}");\nconst res = await fetch("${url}", {\n  method: "POST",\n  headers: { "x-api-key": "${key || 'YOUR_KEY'}" },\n  body: form\n});\nconsole.log(await res.json());`; return; }
      if (body && m !== 'GET') c += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
      c += `\n\n// JavaScript (fetch)\nconst res = await fetch("${url}", {\n  method: "${m}",\n  headers: { "x-api-key": "${key || 'YOUR_KEY'}"${body && m !== 'GET' ? ', "Content-Type": "application/json"' : ''} }${body && m !== 'GET' ? `,\n  body: JSON.stringify(${body})` : ''}\n});\nconsole.log(await res.json());`;
      $('#snippet').textContent = c;
    }
    let multipart = false;
    const load = (e) => {
      multipart = !!e.multipart;
      $('#file-tab').hidden = !multipart;
      $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === (multipart ? 'file' : 'params')));
      $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== (multipart ? 'file' : 'params')));
      $('#method').value = e.method; $('#url').value = BASE_URL + e.path; $('#qp').innerHTML = '';
      e.params.forEach((p) => kvRow($('#qp'), p.name, p.example));
      $('#body').value = e.body ? JSON.stringify(e.body, null, 2) : '';
      syncUrl(); snippet();
      $$('.quick-ep').forEach((b) => (b.style.background = ''));
    };
    $$('.quick-ep').forEach((b) => (b.onclick = () => { load(eps[b.dataset.i]); b.style.background = 'var(--accent-dim)'; }));
    $('#add-qp').onclick = () => kvRow($('#qp'));
    $('#add-hd').onclick = () => kvRow($('#hd'));
    $$('.tab').forEach((t) => (t.onclick = () => { $$('.tab').forEach((x) => x.classList.toggle('active', x === t)); $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== t.dataset.tab)); snippet(); }));
    ['method', 'key', 'body', 'texp', 'tfile'].forEach((id) => ($('#' + id).oninput = snippet));
    $('#url').oninput = () => {
      const [, qs] = $('#url').value.split('?'); $('#qp').innerHTML = '';
      new URLSearchParams(qs || '').forEach((v, k) => kvRow($('#qp'), k, v)); snippet();
    };
    $('#copy-snip').onclick = () => copy($('#snippet').textContent, 'Snippet copied');
    let lastResp = '';
    $('#cp-url').onclick = () => copy($('#url').value.trim(), 'Endpoint URL copied');
    $('#cp-urlkey').onclick = () => {
      const u = $('#url').value.trim(), k = $('#key').value;
      if (!k) toast('No API key selected — copied with YOUR_API_KEY placeholder');
      copy(u + (u.includes('?') ? '&' : '?') + 'apikey=' + (k || 'YOUR_API_KEY'), k ? 'Full URL with API key copied' : 'URL copied');
    };
    $('#cp-resp').onclick = () => lastResp ? copy(lastResp, 'Response copied') : toast('Send a request first', true);
    $('#send').onclick = async () => {
      const btn = $('#send'); btn.disabled = true; btn.innerHTML = 'Sending…';
      const m = $('#method').value; let url = $('#url').value.trim();
      if (url.startsWith('/')) url = BASE_URL + url;
      // route hub requests through the configured API base
      if (API && url.startsWith(location.origin)) url = API + url.slice(location.origin.length);
      const headers = Object.fromEntries(readKV($('#hd')));
      if ($('#key').value) headers['x-api-key'] = $('#key').value;
      const opts = { method: m, headers };
      const b = $('#body').value.trim();
      if (multipart) {
        const f = $('#tfile').files[0];
        if (!f) { toast('Choose a file in the "File (multipart)" tab', true); btn.disabled = false; btn.innerHTML = `${I.send} Send`; return; }
        const fd = new FormData(); fd.append('file', f); fd.append('expire', $('#texp').value); opts.body = fd;
      } else if (b && m !== 'GET') { headers['Content-Type'] = 'application/json'; opts.body = b; }
      const t0 = performance.now();
      try {
        const r = await fetch(url, opts); const ms = Math.round(performance.now() - t0);
        const text = await r.text(); let out; try { out = jsonHL(JSON.parse(text)); lastResp = JSON.stringify(JSON.parse(text), null, 2); } catch { out = esc(text); lastResp = text; }
        const cr = r.headers.get('X-Credits-Remaining');
        $('#meta').innerHTML = `<span class="st st-${String(r.status)[0]}">${r.status} ${esc(r.statusText)}</span><span>${ms} ms</span><span>${(new Blob([text]).size / 1024).toFixed(2)} KB</span>${cr !== null ? `<span style="color:var(--gold)">${fmtN(cr)} credits left</span>` : ''}`;
        $('#resp').innerHTML = out;
        if (cr !== null) { me.credits = Number(cr); const c = $('#side-credits'); if (c) c.textContent = fmtN(cr); }
      } catch (e) {
        $('#meta').innerHTML = `<span class="st st-5">NETWORK ERROR</span>`;
        $('#resp').textContent = String(e.message || e) + '\n\nCheck the URL, or the target API may not allow CORS requests from the browser.';
      }
      btn.disabled = false; btn.innerHTML = `${I.send} Send`;
    };
    const pre = params.ep ? eps.find((e) => e.path === params.ep) : null;
    load(pre || eps[0]);
  }

  // ---------- FILE HOSTING (Dragon Hosting) ----------
  async function viewFiles() {
    await refreshMe();
    const keys = me.keys.filter((k) => !k.revoked);
    shell('files', `
      <div class="page-head"><div><div class="kicker">// powered by dragon hosting</div><h1>File Hosting</h1><p>Upload files and get a download link + short link. Each upload uses 1 credit; downloads are free.</p></div><a class="btn" href="#/docs">${I.book} API docs</a></div>
      ${keys.length ? '' : `<div class="new-key-banner"><p>You need an API key to upload files.</p><a class="btn btn-primary btn-sm" href="#/keys">${I.key} Generate a key</a></div>`}
      <div class="grid g-21">
        <div class="card">
          <div class="card-head"><h3>Upload a file</h3><span class="hint">max 4 MB</span></div>
          <label class="drop" id="drop" tabindex="0"><input type="file" id="ff" hidden><span class="dico">${I.upload}</span><b id="fname">Drop a file here or click to browse</b><span class="small muted">Images, documents, archives, audio, video · executables blocked</span></label>
          <div class="grid g-2 mt" style="gap:.8rem">
            <div class="field"><label for="fexp">Expiration</label><select class="select" id="fexp">${EXPIRES.map(([v, l]) => `<option value="${v}" ${v === '86400' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label for="fkey">API key</label><select class="select mono" id="fkey">${keys.map((k) => `<option value="${esc(k.key)}">${esc(k.name)} — ${esc(k.key.slice(0, 14))}…</option>`).join('')}</select></div>
          </div>
          <button class="btn btn-primary mt" id="fup" style="width:100%" ${keys.length ? '' : 'disabled'}>${I.upload} Upload</button>
          <div id="fres"></div>
        </div>
        <div class="card"><div class="card-head"><h3>Storage</h3></div><div id="fstore"><div class="skeleton"></div><div class="skeleton mt"></div></div></div>
      </div>
      <div class="card mt"><div class="card-head"><h3>My files</h3><button class="btn btn-ghost btn-sm" id="frl">Refresh</button></div><div id="flist"><div class="skeleton"></div></div></div>`);

    let picked = null;
    const ff = $('#ff'), drop = $('#drop');
    const pick = (f) => { picked = f || null; $('#fname').textContent = f ? `${f.name} · ${fmtBytes(f.size)}` : 'Drop a file here or click to browse'; drop.classList.toggle('has', !!f); };
    ff.onchange = () => pick(ff.files[0]);
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ff.click(); } };
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => pick(e.dataTransfer.files[0]));

    const keyVal = () => $('#fkey') && $('#fkey').value;
    const call = async (path, opts = {}) => {
      const r = await fetch(API + path, { ...opts, headers: { 'x-api-key': keyVal(), ...(opts.headers || {}) } });
      const j = await r.json().catch(() => ({ success: false, error: 'Unexpected response' }));
      const cr = r.headers.get('X-Credits-Remaining'); if (cr !== null) { me.credits = Number(cr); const c = $('#side-credits'); if (c) c.textContent = fmtN(cr); }
      if (!j.success) throw new Error(j.error || 'Request failed');
      return j.data;
    };
    const linkRow = (label, url) => `<div class="kv-out"><span class="small muted">${label}</span><div class="row" style="gap:.4rem"><input class="input mono" readonly value="${esc(url)}" aria-label="${label}"><button class="btn btn-sm" data-cp="${esc(url)}">${I.copy}</button></div></div>`;
    const wireCopy = (root) => $$('[data-cp]', root).forEach((b) => (b.onclick = () => copy(b.dataset.cp, 'Link copied')));

    async function loadList() {
      if (!keys.length) { $('#flist').innerHTML = `<div class="empty">${I.upload}<div>Generate an API key to start uploading.</div></div>`; $('#fstore').innerHTML = '<p class="small muted">No data yet.</p>'; return; }
      try {
        const d = await call('/api/v1/files/list');
        const pct = Math.min(100, (d.storage.used / d.storage.limit) * 100);
        $('#fstore').innerHTML = `<div class="kpi" style="padding:0"><div class="val">${fmtBytes(d.storage.used)}</div><div class="sub">of ${fmtBytes(d.storage.limit)} · ${fmtN(d.activeFiles)} active files</div></div><div class="meter mt"><i style="width:${pct}%"></i></div><p class="small muted mt">Expired and deleted files don't count toward storage.</p>`;
        $('#flist').innerHTML = d.files.length ? `<div class="table-wrap"><table><thead><tr><th>File</th><th>Size</th><th>Type</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>${d.files.map((f) => `<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${esc(f.filename)}">${esc(f.filename)}</td><td class="mono">${fmtBytes(f.size)}</td><td><code>${esc(f.mimeType)}</code></td><td><span class="tag ${f.status === 'active' ? '' : 'banned'}">${f.status}</span></td><td class="muted small">${f.expiresAt ? fmtDate(f.expiresAt) : 'Never'}</td><td><div class="row" style="gap:.3rem;justify-content:flex-end">${f.status === 'active' ? `<button class="btn btn-sm" data-cp="${esc(f.shortUrl)}" title="Copy short link">${I.copy} Link</button><button class="btn btn-danger btn-sm" data-del="${esc(f.id)}" aria-label="Delete ${esc(f.filename)}">${I.trash}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${I.upload}<div>No files yet — upload your first one.</div></div>`;
        wireCopy($('#flist'));
        $$('[data-del]').forEach((b) => (b.onclick = () => modal(`<h3>Delete this file?</h3><p class="muted small">Its download and short links will stop working immediately.</p><div class="actions"><button class="btn" data-x>Cancel</button><button class="btn btn-danger" data-ok>${I.trash} Delete</button></div>`, (m, close) => {
          $('[data-x]', m).onclick = close;
          $('[data-ok]', m).onclick = async () => { try { await call('/api/v1/files/delete?id=' + encodeURIComponent(b.dataset.del), { method: 'DELETE' }); close(); toast('File deleted'); loadList(); } catch (e) { toast(e.message, true); } };
        })));
      } catch (e) { $('#flist').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }

    $('#fup').onclick = async () => {
      if (!picked) return toast('Choose a file first', true);
      if (picked.size > 4 * 1024 * 1024) return toast('File is larger than 4 MB', true);
      const btn = $('#fup'); btn.disabled = true; btn.innerHTML = 'Uploading…';
      try {
        const fd = new FormData(); fd.append('file', picked); fd.append('expire', $('#fexp').value);
        const d = await call('/api/v1/files/upload', { method: 'POST', body: fd });
        $('#fres').innerHTML = `<div class="up-ok mt"><div class="row" style="justify-content:space-between"><b>${esc(d.filename)}</b><span class="tag">${fmtBytes(d.size)} · ${esc(d.mimeType)}</span></div>${linkRow('Short URL', d.shortUrl)}${linkRow('Download URL', d.url)}<div class="small muted">File ID <code class="mono">${esc(d.id)}</code> · ${d.expiresAt ? 'expires ' + fmtDate(d.expiresAt) : 'never expires'}</div></div>`;
        wireCopy($('#fres'));
        toast('File uploaded'); pick(null); ff.value = ''; loadList();
      } catch (e) { toast(e.message, true); }
      btn.disabled = false; btn.innerHTML = `${I.upload} Upload`;
    };
    $('#frl').onclick = loadList;
    loadList();
  }

  // ---------- DOCS ----------
  async function viewDocs() {
    const eps = await getCatalog();
    const groups = [...new Set(eps.map((e) => e.group))];
    const slug = (p) => p.replace(/[^a-z0-9]+/gi, '-');
    const content = `
      <div class="page-head"><div><h1>API Documentation</h1><p>Base URL <code class="mono" style="color:var(--accent)">${esc(BASE_URL)}/api/v1</code> · JSON responses · 1 credit / successful request</p></div>${me ? `<a class="btn btn-primary" href="#/keys">${I.key} My API keys</a>` : `<a class="btn btn-primary" href="#/register">Get API key</a>`}</div>
      <div class="docs-layout">
        <nav class="docs-toc" aria-label="Endpoints"><a href="#/docs" data-scroll="auth">Authentication</a><a href="#/docs" data-scroll="errors">Errors & credits</a>
          ${groups.map((g) => `<div class="grp">${esc(g)}</div>${eps.filter((e) => e.group === g).map((e) => `<a href="#/docs" data-scroll="${slug(e.path)}"><span class="m m-${e.method}">${e.method}</span>${esc(e.title)}</a>`).join('')}`).join('')}
        </nav>
        <div style="display:flex;flex-direction:column;gap:1rem;min-width:0">
          <div class="card doc-ep" id="auth"><h3>Authentication</h3><p class="desc" style="margin-top:.5rem">All <code class="mono">/api/v1/*</code> endpoints require an API key. Send it as a header (recommended) or query parameter.</p>
            <pre class="code wrap">x-api-key: zk_live_xxxxxxxxxxxxxxxx\n\n# or\n${esc(BASE_URL)}/api/v1/ping?apikey=zk_live_xxxxxxxx</pre></div>
          <div class="card doc-ep" id="errors"><h3>Errors & credits</h3><p class="desc" style="margin-top:.5rem">Every response has <code class="mono">success</code>. Successful calls cost 1 credit; the header <code class="mono">X-Credits-Remaining</code> shows your balance.</p>
            <div class="table-wrap" style="margin:0"><table><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody>
            <tr><td>${statusCell(200)}</td><td>Success</td></tr><tr><td>${statusCell(400)}</td><td>Missing or invalid parameter</td></tr><tr><td>${statusCell(401)}</td><td>Missing / invalid / revoked API key</td></tr><tr><td>${statusCell(402)}</td><td>Out of credits</td></tr><tr><td>${statusCell(403)}</td><td>Account suspended</td></tr><tr><td>${statusCell(404)}</td><td>Endpoint or file not found</td></tr><tr><td>${statusCell(410)}</td><td>File expired</td></tr><tr><td>${statusCell(413)}</td><td>File too large / storage quota exceeded</td></tr><tr><td>${statusCell(415)}</td><td>Not multipart, or blocked file type</td></tr><tr><td>${statusCell(429)}</td><td>Too many requests</td></tr></tbody></table></div><p class="small muted mt">File Hosting errors also include a machine-readable <code class="mono">code</code>, e.g. <code class="mono">{"success":false,"error":"Invalid or missing file.","code":"INVALID_FILE"}</code>.</p></div>
          ${eps.map((e, i) => `
            <div class="card doc-ep" id="${slug(e.path)}">
              <h3><span class="m m-${e.method}">${e.method}</span>${esc(e.title)} <span class="tag">${esc(e.group)}</span></h3>
              <div class="path-row"><div class="path">${esc(e.path)}</div><div class="row" style="gap:.4rem"><button class="btn btn-sm" data-cpurl="${i}" title="Copy the full endpoint URL">${I.copy} Copy URL</button>${e.public ? '' : `<button class="btn btn-primary btn-sm" data-cpkey="${i}" title="Copy the full endpoint URL including your API key">${I.key} Copy URL + key</button>`}</div></div>
              <p class="desc">${esc(e.desc)}</p>
              ${e.multipart ? `<div class="table-wrap" style="margin:0"><table class="param-table"><thead><tr><th>Form field</th><th>Required</th><th>Example</th></tr></thead><tbody>${e.multipart.map((p) => `<tr><td><code>${esc(p.name)}</code> <span class="tag">${esc(p.type)}</span></td><td>${p.required ? '<span class="tag admin">required</span>' : '<span class="tag">optional</span>'}</td><td><code>${esc(p.example)}</code></td></tr>`).join('')}</tbody></table></div><pre class="code wrap">${jsonHL({ success: true, data: { id: 'Qm7xK2pLr9TzW4cA', filename: 'image.png', size: 24567, mimeType: 'image/png', url: BASE_URL + '/api/files/download/Qm7xK2pLr9TzW4cA', shortUrl: BASE_URL + '/f/Qm7xK2pLr9TzW4cA', expiresAt: '2026-09-26T12:00:00.000Z', createdAt: '2026-09-25T12:00:00.000Z', status: 'active' } })}</pre>` : ''}
              ${e.params.length ? `<div class="table-wrap" style="margin:0"><table class="param-table"><thead><tr><th>Param</th><th>Required</th><th>Example</th></tr></thead><tbody>${e.params.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td>${p.required ? '<span class="tag admin">required</span>' : '<span class="tag">optional</span>'}</td><td><code>${esc(p.example)}</code></td></tr>`).join('')}</tbody></table></div>` : ''}
              <div class="doc-try">
                <div><div class="tabs snippet-tabs"><button class="tab active" data-lang="curl" data-i="${i}">cURL</button><button class="tab" data-lang="js" data-i="${i}">JavaScript</button><button class="tab" data-lang="py" data-i="${i}">Python</button><button class="tab" data-lang="php" data-i="${i}">PHP</button></div><pre class="code wrap" id="snip-${i}"></pre></div>
                <div><div class="row" style="justify-content:space-between;margin-bottom:.6rem"><span class="small muted">Live response</span><div class="row"><button class="btn btn-ghost btn-sm" data-cpresp="${i}" title="Copy response">${I.copy} Copy</button>${e.multipart || e.public ? `<a class="btn btn-sm" href="#/files">${I.upload} Open File Hosting</a>` : me ? `<button class="btn btn-primary btn-sm" data-try="${i}">${I.send} Try it</button><a class="btn btn-sm" href="#/tester?ep=${encodeURIComponent(e.path)}">Open in tester</a>` : `<a class="btn btn-sm" href="#/login">Log in to try</a>`}</div></div><pre class="code" id="out-${i}" style="min-height:120px;max-height:320px"><span class="j-null">// click “Try it”</span></pre></div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    if (me) shell('docs', content); else { publicWrap(`<div class="section" style="padding-top:1.5rem">${content}</div>`); }
    const urlFor = (e) => BASE_URL + e.path + (e.params.length ? '?' + new URLSearchParams(e.params.map((p) => [p.name, p.example])).toString() : '');
    const snip = (e, lang) => {
      if (e.multipart) {
        const u = BASE_URL + e.path;
        if (lang === 'curl') return `curl -X POST "${u}" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -F "file=@image.png" \\\n  -F "expire=86400"`;
        if (lang === 'js') return `const form = new FormData();\nform.append("file", fileInput.files[0]);\nform.append("expire", "86400"); // optional\n\nconst res = await fetch("${u}", {\n  method: "POST",\n  headers: { "x-api-key": "YOUR_API_KEY" },\n  body: form\n});\nconst data = await res.json();\nconsole.log(data.data.shortUrl);`;
        if (lang === 'py') return `import requests\n\nwith open("image.png", "rb") as f:\n    res = requests.post(\n        "${u}",\n        headers={"x-api-key": "YOUR_API_KEY"},\n        files={"file": f},\n        data={"expire": "86400"}\n    )\nprint(res.json()["data"]["shortUrl"])`;
        return `<?php\n$ch = curl_init("${u}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_POST, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: YOUR_API_KEY"]);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, [\n  "file" => new CURLFile("image.png"),\n  "expire" => "86400"\n]);\n$data = json_decode(curl_exec($ch), true);\nprint_r($data);`;
      }
      if (e.public) {
        const u = BASE_URL + '/f/FILE_ID';
        if (lang === 'curl') return `# public link — no API key, no credits\ncurl -L -o file.png "${u}"`;
        if (lang === 'js') return `const res = await fetch("${u}"); // follows the 302 redirect\nconst blob = await res.blob();`;
        if (lang === 'py') return `import requests\n\nres = requests.get("${u}", allow_redirects=True)\nopen("file.png", "wb").write(res.content)`;
        return `<?php\nfile_put_contents("file.png", file_get_contents("${u}"));`;
      }
      const u = urlFor(e); const post = e.method !== 'GET'; const b = e.body ? JSON.stringify(e.body) : '{}';
      if (lang === 'curl') return `curl -X ${e.method} "${u}" \\\n  -H "x-api-key: YOUR_API_KEY"${post ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${b}'` : ''}`;
      if (lang === 'js') return `const res = await fetch("${u}", {\n  method: "${e.method}",\n  headers: { "x-api-key": "YOUR_API_KEY"${post ? ', "Content-Type": "application/json"' : ''} }${post ? `,\n  body: JSON.stringify(${b})` : ''}\n});\nconst data = await res.json();\nconsole.log(data);`;
      if (lang === 'py') return `import requests\n\nres = requests.${e.method.toLowerCase()}(\n    "${u}",\n    headers={"x-api-key": "YOUR_API_KEY"}${post ? `,\n    json=${b}` : ''}\n)\nprint(res.json())`;
      return `<?php\n$ch = curl_init("${u}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${e.method}");\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: YOUR_API_KEY"${post ? ', "Content-Type: application/json"' : ''}]);${post ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, '${b}');` : ''}\n$data = json_decode(curl_exec($ch), true);\nprint_r($data);`;
    };
    eps.forEach((e, i) => ($('#snip-' + i).textContent = snip(e, 'curl')));
    const userKey = () => (me && me.keys.find((k) => !k.revoked)) || null;
    const fullUrl = (e, withKey) => {
      const base = e.public ? BASE_URL + '/f/FILE_ID' : e.multipart ? BASE_URL + e.path : urlFor(e);
      if (!withKey) return base;
      return base + (base.includes('?') ? '&' : '?') + 'apikey=' + (userKey() ? userKey().key : 'YOUR_API_KEY');
    };
    $$('[data-cpurl]').forEach((b) => (b.onclick = () => copy(fullUrl(eps[b.dataset.cpurl], false), 'Endpoint URL copied')));
    $$('[data-cpkey]').forEach((b) => (b.onclick = () => {
      if (!me) toast('Log in and create an API key to copy with your real key — copied with YOUR_API_KEY placeholder');
      else if (!userKey()) toast('No API key yet — copied with YOUR_API_KEY placeholder. Create one on the API Keys page.');
      copy(fullUrl(eps[b.dataset.cpkey], true), userKey() ? 'Full URL with API key copied' : 'URL copied');
    }));
    $$('[data-cpresp]').forEach((b) => (b.onclick = () => {
      const t = $('#out-' + b.dataset.cpresp).textContent.replace(/^\/\/.*\n/, '').trim();
      if (!t || t.startsWith('// click')) return toast('Run “Try it” first to get a response', true);
      copy(t, 'Response copied');
    }));
    $$('.snippet-tabs .tab').forEach((t) => (t.onclick = () => { $$('.tab', t.parentElement).forEach((x) => x.classList.toggle('active', x === t)); $('#snip-' + t.dataset.i).textContent = snip(eps[t.dataset.i], t.dataset.lang); }));
    $$('[data-scroll]').forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); document.getElementById(a.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }); }));
    $$('[data-try]').forEach((b) => (b.onclick = async () => {
      const e = eps[b.dataset.try]; const out = $('#out-' + b.dataset.try);
      const key = me.keys.find((k) => !k.revoked);
      if (!key) { out.innerHTML = `<span class="j-s">"You need an API key first → API Keys page"</span>`; return; }
      b.disabled = true; out.innerHTML = '<span class="j-null">// loading…</span>';
      try {
        const r = await fetch(API + urlFor(e).slice(BASE_URL.length), { method: e.method, headers: { 'x-api-key': key.key, 'Content-Type': 'application/json' }, body: e.method !== 'GET' ? JSON.stringify(e.body || {}) : undefined });
        const j = await r.json(); out.innerHTML = `<span class="j-null">// ${r.status} · ${r.headers.get('X-Response-Time') || ''}</span>\n` + jsonHL(j);
        const cr = r.headers.get('X-Credits-Remaining'); if (cr !== null) { me.credits = Number(cr); const c = $('#side-credits'); if (c) c.textContent = fmtN(cr); }
      } catch (err) { out.textContent = String(err); }
      b.disabled = false;
    }));
  }

  // ---------- HISTORY ----------
  async function viewHistory() {
    shell('history', `<div class="page-head"><div><h1>Request History</h1><p>Your last 200 API requests with response previews.</p></div><button class="btn" id="export">Export JSON</button></div>
      <div class="filters"><input class="input" id="fq" placeholder="Filter by endpoint…"><select class="select" id="fs"><option value="">All statuses</option><option value="2">2xx Success</option><option value="4">4xx Client error</option><option value="5">5xx Server error</option></select></div>
      <div class="card" id="hist"><div class="skeleton"></div><div class="skeleton mt"></div><div class="skeleton mt"></div></div>`);
    const u = await api('/api/usage');
    const render = () => {
      const q = $('#fq').value.toLowerCase(), s = $('#fs').value;
      const rows = u.history.filter((h) => (!q || h.endpoint.toLowerCase().includes(q)) && (!s || String(h.status)[0] === s));
      $('#hist').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Status</th><th>Method</th><th>Endpoint</th><th>Query</th><th>Latency</th><th>Key</th><th>Time</th><th></th></tr></thead><tbody>
        ${rows.map((h, i) => `<tr><td>${statusCell(h.status)}</td><td><span class="m m-${h.method}">${h.method}</span></td><td><code>${esc(h.endpoint)}</code></td><td class="mono muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(new URLSearchParams(h.query || {}).toString() || '—')}</td><td class="mono">${h.ms}ms</td><td class="mono muted">${esc(h.key || '')}</td><td class="muted small">${fmtDate(h.at)}</td><td><button class="btn btn-ghost btn-sm" data-d="${i}">View</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty">${I.clock}<div>${u.history.length ? 'No requests match these filters.' : 'No requests yet — try the <a href="#/tester">API tester</a>.'}</div></div>`;
      $$('[data-d]').forEach((b) => (b.onclick = () => {
        const h = rows[b.dataset.d]; let resp = h.response || '';
        try { resp = jsonHL(JSON.parse(resp)); } catch { resp = esc(resp) + (resp.length >= 600 ? '…' : ''); }
        modal(`<h3>${esc(h.method)} ${esc(h.endpoint)}</h3><div class="resp-meta" style="margin-bottom:.8rem">${statusCell(h.status)}<span>${h.ms}ms</span><span>${fmtDate(h.at)}</span></div><div class="small muted" style="margin-bottom:.3rem">Query</div><pre class="code wrap">${jsonHL(h.query || {})}</pre><div class="small muted" style="margin:.8rem 0 .3rem">Response (preview)</div><pre class="code wrap" style="max-height:260px">${resp || '—'}</pre><div class="actions"><button class="btn" data-x>Close</button></div>`, (m, close) => ($('[data-x]', m).onclick = close));
        $('.modal').style.maxWidth = '640px';
      }));
    };
    $('#fq').oninput = render; $('#fs').onchange = render; render();
    $('#export').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(u.history, null, 2)], { type: 'application/json' })); a.download = 'zayra-history.json'; a.click(); };
  }

  // ---------- PROFILE ----------
  async function viewProfile() {
    await refreshMe();
    shell('profile', `
      <div class="page-head"><div><h1>Developer Profile</h1><p>Manage your public details and account security.</p></div></div>
      <div class="card profile-card"><div class="avatar lg">${esc((me.displayName || me.username)[0].toUpperCase())}</div>
        <div><h2>${esc(me.displayName || me.username)}</h2><div class="mono small muted">@${esc(me.username)} · ${me.role === 'admin' ? '<span class="tag admin">admin</span>' : '<span class="tag">developer</span>'} · joined ${new Date(me.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
        ${me.bio ? `<p class="small" style="margin-top:.4rem">${esc(me.bio)}</p>` : ''}</div></div>
      <div class="grid g-4 mt">
        <div class="card kpi gold"><div class="lbl">Credits</div><div class="val">${fmtN(me.credits)}</div></div>
        <div class="card kpi accent"><div class="lbl">Total requests</div><div class="val">${fmtN(me.totalRequests)}</div></div>
        <div class="card kpi"><div class="lbl">Active keys</div><div class="val">${me.keys.filter((k) => !k.revoked).length}</div></div>
        <div class="card kpi"><div class="lbl">Last login</div><div class="val" style="font-size:1.1rem;margin-top:.8rem">${ago(me.lastLogin)}</div></div>
      </div>
      <div class="grid g-21 mt">
        <form class="card" id="pf"><div class="card-head"><h3>Profile details</h3></div>
          <div class="form-grid">
            <div class="field"><label for="dn">Display name</label><input class="input" id="dn" value="${esc(me.displayName)}"></div>
            <div class="field"><label for="em">Email</label><input class="input" id="em" type="email" value="${esc(me.email)}"></div>
            <div class="field"><label for="gh">GitHub username</label><input class="input" id="gh" value="${esc(me.github)}" placeholder="octocat"></div>
            <div class="field"><label for="ws">Website</label><input class="input" id="ws" value="${esc(me.website)}" placeholder="https://"></div>
            <div class="field full"><label for="bio">Bio</label><textarea class="textarea" id="bio" style="font-family:var(--font-body);min-height:90px" maxlength="300" placeholder="Full-stack dev from Colombo…">${esc(me.bio)}</textarea></div>
          </div>
          <button class="btn btn-primary mt" type="submit">Save profile</button>
        </form>
        <form class="card" id="pw"><div class="card-head"><h3>Change password</h3></div>
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div class="field"><label for="cur">Current password</label><input class="input" id="cur" type="password" required autocomplete="current-password"></div>
            <div class="field"><label for="nw">New password</label><input class="input" id="nw" type="password" required minlength="6" autocomplete="new-password"></div>
          </div>
          <button class="btn mt" type="submit">Update password</button>
        </form>
      </div>`);
    $('#pf').onsubmit = async (e) => {
      e.preventDefault();
      try { me = (await api('/api/me', { method: 'PUT', body: { displayName: $('#dn').value, email: $('#em').value, github: $('#gh').value, website: $('#ws').value, bio: $('#bio').value } })).user; toast('Profile saved'); viewProfile(); }
      catch (err) { toast(err.message, true); }
    };
    $('#pw').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/me/password', { method: 'POST', body: { current: $('#cur').value, next: $('#nw').value } }); toast('Password updated'); e.target.reset(); }
      catch (err) { toast(err.message, true); }
    };
  }

  // ---------- ADMIN ----------
  async function viewAdmin(params) {
    const tab = params.tab || 'overview';
    shell('admin', `
      <div class="page-head"><div><div class="kicker">// admin console</div><h1>Admin Dashboard</h1><p>Platform analytics, users and live request logs.</p></div><button class="btn" id="reload">Refresh</button></div>
      <div class="tabs" role="tablist">${[['overview', 'Overview & analytics'], ['users', 'Users'], ['logs', 'Request logs']].map(([k, l]) => `<a class="tab ${tab === k ? 'active' : ''}" href="#/admin?tab=${k}">${l}</a>`).join('')}</div>
      <div id="adm"><div class="grid g-4">${'<div class="card"><div class="skeleton"></div><div class="skeleton mt" style="height:30px"></div></div>'.repeat(4)}</div></div>`);
    $('#reload').onclick = () => viewAdmin(params);
    if (tab === 'overview') {
      const [s] = await Promise.all([api('/api/admin/stats'), waitChart()]);
      const days = lastNDays(30);
      const t = s.totals;
      const st = { '2xx': 0, '4xx': 0, '5xx': 0 };
      Object.entries(s.statuses).forEach(([k, v]) => { const c = k[0] + 'xx'; if (st[c] !== undefined) st[c] += v; });
      $('#adm').innerHTML = `
        <div class="grid g-4">
          <div class="card kpi accent"><div class="lbl">${I.users} Total users</div><div class="val">${fmtN(t.users)}</div><div class="sub">${t.banned} suspended</div></div>
          <div class="card kpi"><div class="lbl">${I.bolt} Total requests</div><div class="val">${fmtN(t.requests)}</div><div class="sub">${fmtN(t.requestsToday)} today</div></div>
          <div class="card kpi"><div class="lbl">${I.key} Active API keys</div><div class="val">${fmtN(t.activeKeys)}</div><div class="sub">across all users</div></div>
          <div class="card kpi gold"><div class="lbl">${I.coin} Credits in circulation</div><div class="val">${fmtN(t.creditsInCirculation)}</div><div class="sub">excluding admins</div></div>
        </div>
        <div class="grid g-21 mt">
          <div class="card"><div class="card-head"><h3>Platform requests · 30 days</h3><span class="hint mono">storage: ${esc(s.storage)}</span></div><div class="chart-box"><canvas id="a1"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Status codes</h3></div><div class="chart-box sm">${Object.values(st).some(Boolean) ? '<canvas id="a2"></canvas>' : '<div class="empty">No data yet.</div>'}</div></div>
        </div>
        <div class="grid g-4 mt">
          <div class="card kpi"><div class="lbl">${I.upload} Files uploaded</div><div class="val">${fmtN(s.files?.uploads)}</div><div class="sub">via Dragon Hosting API</div></div>
          <div class="card kpi"><div class="lbl">${I.list} Data uploaded</div><div class="val">${fmtBytes(s.files?.bytes)}</div><div class="sub">all time</div></div>
          <div class="card kpi"><div class="lbl">${I.bolt} File downloads</div><div class="val">${fmtN(s.files?.downloads)}</div><div class="sub">public links</div></div>
          <div class="card kpi"><div class="lbl">${I.shield} Upload limit</div><div class="val">4 MB</div><div class="sub">per file (Vercel limit)</div></div>
        </div>
        <div class="card mt"><div class="card-head"><h3>Endpoint popularity</h3></div>${barList(s.endpoints, 14)}</div>
        ${s.storage === 'memory' ? `<div class="card mt" style="border-color:#f5b53d44"><div class="card-head"><h3 style="color:var(--gold)">Storage notice</h3></div><p class="small muted">Running with in-memory storage. On Vercel, connect an <b>Upstash Redis</b> database (Storage tab → Marketplace) so users, keys and logs persist permanently.</p></div>` : ''}`;
      lineChart($('#a1'), days.map((d) => d.slice(5)), days.map((d) => s.daily[d] || 0), '#f5b53d');
      $('#a2') && doughnut($('#a2'), Object.keys(st), Object.values(st));
    }
    if (tab === 'users') {
      const { users } = await api('/api/admin/users');
      const render = (f = '') => {
        const list = users.filter((u) => !f || u.username.includes(f) || (u.displayName || '').toLowerCase().includes(f) || (u.email || '').toLowerCase().includes(f));
        $('#ut').innerHTML = list.map((u) => `<tr>
          <td><div class="row" style="flex-wrap:nowrap"><div class="avatar" style="width:28px;height:28px;font-size:.8rem">${esc((u.displayName || u.username)[0].toUpperCase())}</div><div><div style="font-weight:600">${esc(u.displayName || u.username)}</div><div class="mono small muted">@${esc(u.username)}</div></div></div></td>
          <td>${u.role === 'admin' ? '<span class="tag admin">admin</span>' : '<span class="tag">user</span>'} ${u.banned ? '<span class="tag banned">banned</span>' : ''}</td>
          <td class="mono" style="color:var(--gold)">${fmtN(u.credits)}</td><td class="mono">${fmtN(u.totalRequests)}</td><td class="mono">${u.keys}</td>
          <td class="muted small">${fmtDate(u.createdAt)}</td>
          <td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-sm" data-cr="${esc(u.username)}">Credits</button>${u.role === 'admin' && u.username === 'sandaru' ? '' : `<button class="btn btn-sm ${u.banned ? '' : 'btn-danger'}" data-ban="${esc(u.username)}" data-v="${u.banned ? 0 : 1}">${u.banned ? 'Unban' : 'Ban'}</button>`}</div></td></tr>`).join('') || `<tr><td colspan="7"><div class="empty">No users found.</div></td></tr>`;
        $$('[data-cr]').forEach((b) => (b.onclick = () => modal(`<h3>Adjust credits · @${esc(b.dataset.cr)}</h3><div class="field"><label for="amt">Add credits (use negative to remove)</label><input class="input mono" id="amt" type="number" value="100"></div><div class="row mt">${[50, 100, 500, 1000].map((n) => `<button class="btn btn-sm" data-q="${n}">+${n}</button>`).join('')}</div><div class="actions"><button class="btn" data-x>Cancel</button><button class="btn btn-gold" data-ok>Apply</button></div>`, (m, close) => {
          $$('[data-q]', m).forEach((q) => (q.onclick = () => ($('#amt', m).value = q.dataset.q)));
          $('[data-x]', m).onclick = close;
          $('[data-ok]', m).onclick = async () => { try { const r = await api('/api/admin/users/update', { method: 'POST', body: { username: b.dataset.cr, addCredits: Number($('#amt', m).value) } }); close(); toast(`@${r.user.username} now has ${fmtN(r.user.credits)} credits`); viewAdmin(params); } catch (e) { toast(e.message, true); } };
        })));
        $$('[data-ban]').forEach((b) => (b.onclick = async () => { try { await api('/api/admin/users/update', { method: 'POST', body: { username: b.dataset.ban, banned: b.dataset.v === '1' } }); toast(b.dataset.v === '1' ? 'User suspended' : 'User restored'); viewAdmin(params); } catch (e) { toast(e.message, true); } }));
      };
      $('#adm').innerHTML = `<div class="filters"><input class="input" id="uf" placeholder="Search users…"></div><div class="card"><div class="card-head"><h3>${users.length} registered users</h3></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Credits</th><th>Requests</th><th>Keys</th><th>Joined</th><th>Actions</th></tr></thead><tbody id="ut"></tbody></table></div></div>`;
      $('#uf').oninput = (e) => render(e.target.value.toLowerCase()); render();
    }
    if (tab === 'logs') {
      const { logs } = await api('/api/admin/logs');
      $('#adm').innerHTML = `<div class="card"><div class="card-head"><h3>Latest ${logs.length} platform requests</h3></div>${logs.length ? `<div class="table-wrap"><table><thead><tr><th>Status</th><th>User</th><th>Method</th><th>Endpoint</th><th>Latency</th><th>Time</th></tr></thead><tbody>${logs.map((h) => `<tr><td>${statusCell(h.status)}</td><td class="mono">@${esc(h.user)}</td><td><span class="m m-${h.method}">${h.method}</span></td><td><code>${esc(h.endpoint)}</code></td><td class="mono">${h.ms}ms</td><td class="muted small">${fmtDate(h.at)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">No requests logged yet.</div>`}</div>`;
    }
  }

  router();
})();
