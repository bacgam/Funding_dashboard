const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  funding: '<path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>',
  arbitrage: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  overview: '<path d="M4 20V10m6 10V4m6 16v-7m5 7H2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  gap: '<path d="M4 5h16M4 19h16M8 9l4-4 4 4m-8 6 4 4 4-4"/>',
};
const icon = name => `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

// Add future destinations to the appropriate group and handle their page IDs in app.js.
export const navigationGroups = [
  { id: 'dashboard', label: '대시보드', items: [
    { id: 'overview', label: '마켓 개요', icon: 'overview' },
    { id: 'favorites', label: '관심 마켓', icon: 'star' },
  ] },
  { id: 'funding', label: '펀딩비', items: [
    { id: 'funding', label: '실시간 펀딩비', icon: 'pulse', mode: 'funding' },
  ] },
  { id: 'arbitrage', label: '아비트라지', items: [
    { id: 'gap', label: '선물 가격 갭', icon: 'gap', mode: 'gap' },
  ] },
];

export function initNavigation({ onNavigate, onGuide }) {
  const sidebar = document.querySelector('#sidebar');
  const nav = document.querySelector('#category-nav');
  const content = document.querySelector('.app-content');
  const toggle = document.querySelector('#menu-toggle');
  const close = document.querySelector('#menu-close');
  const backdrop = document.querySelector('#sidebar-backdrop');
  const mobile = matchMedia('(max-width: 1179px)');
  const pages = navigationGroups.flatMap(group => group.items);
  let expanded = {};
  try { const saved = JSON.parse(localStorage.getItem('perpdex-navigation') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) expanded = saved; } catch {}
  let currentPage;
  let drawerOpen = false;
  let previousFocus;

  nav.innerHTML = navigationGroups.map(group => `
    <section class="nav-group">
      <button class="nav-group-toggle" data-group="${group.id}" aria-expanded="true" aria-controls="nav-${group.id}">
        ${icon(group.id)}<span>${group.label}</span><svg class="nav-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>
      </button>
      <div class="nav-children" id="nav-${group.id}">${group.items.map(item => `
        <a class="nav-item" href="#${item.id}" data-page="${item.id}"${item.mode ? ` data-mode="${item.mode}"` : ''}>
          ${icon(item.icon)}<span>${item.label}</span><span class="nav-active-dot" aria-hidden="true"></span>
        </a>`).join('')}
      </div>
    </section>`).join('');

  function setExpanded(id, open) {
    expanded[id] = open;
    nav.querySelector(`[data-group="${id}"]`).setAttribute('aria-expanded', String(open));
    nav.querySelector(`#nav-${id}`).hidden = !open;
    try { localStorage.setItem('perpdex-navigation', JSON.stringify(expanded)); } catch {}
  }
  for (const group of navigationGroups) setExpanded(group.id, expanded[group.id] !== false);
  nav.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => {
    setExpanded(button.dataset.group, button.getAttribute('aria-expanded') !== 'true');
  }));

  function setDrawer(open, restoreFocus = true) {
    drawerOpen = open && mobile.matches;
    if (drawerOpen) previousFocus = document.activeElement;
    document.body.classList.toggle('sidebar-open', drawerOpen);
    toggle.setAttribute('aria-expanded', String(drawerOpen));
    sidebar.inert = mobile.matches && !drawerOpen;
    content.inert = drawerOpen;
    backdrop.hidden = !drawerOpen;
    if (drawerOpen) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      close.focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
      previousFocus = null;
    }
  }
  toggle.addEventListener('click', () => setDrawer(!drawerOpen));
  close.addEventListener('click', () => setDrawer(false));
  backdrop.addEventListener('click', () => setDrawer(false));
  mobile.addEventListener('change', () => {
    const focusInSidebar = sidebar.contains(document.activeElement);
    setDrawer(false, false);
    if (focusInSidebar) {
      const target = mobile.matches ? toggle : nav.querySelector('[aria-current="page"]');
      target?.focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (!drawerOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
    if (event.key !== 'Tab') return;
    const focusable = [...sidebar.querySelectorAll('a[href], button')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  function activate(id, scroll = true) {
    const page = pages.find(page => page.id === id) || pages.find(page => page.id === 'funding');
    const group = navigationGroups.find(group => group.items.includes(page));
    currentPage = page.id;
    setExpanded(group.id, true);
    nav.querySelectorAll('[data-page]').forEach(link => {
      const active = link.dataset.page === page.id;
      link.classList.toggle('selected', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    nav.querySelectorAll('[data-group]').forEach(button => button.classList.toggle('contains-active', button.dataset.group === group.id));
    document.querySelector('#current-category').textContent = group.label;
    document.querySelector('#current-page').textContent = page.label;
    document.title = `${page.label} · PERPDEX`;
    const wasOpen = drawerOpen;
    setDrawer(false, false);
    const heading = onNavigate(page.id, scroll) || document.querySelector('#page-title');
    if (wasOpen) heading.focus({ preventScroll: true });
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('[data-page]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    activate(link.dataset.page);
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (!id || pages.some(page => page.id === id)) activate(id);
  });
  document.querySelector('#sidebar-guide').addEventListener('click', () => { setDrawer(false); onGuide(); });
  setDrawer(false, false);
  activate(location.hash.slice(1), false);
  return { get page() { return currentPage; } };
}
