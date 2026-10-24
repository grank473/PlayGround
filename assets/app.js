(() => {
  'use strict';

  const STORAGE_KEY = 'orbit.nav.v1';
  const SYNC_KEY = 'orbit.sync.v1';
  const GIST_FILE = 'orbit-nav.json';
  const GIST_DESCRIPTION = 'Orbit Nav · 数据同步';
  const APP_VERSION = 1;
  const MAX_TAGS = 6;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const CATEGORY_COLORS = ['#8b7cff', '#5ea2ff', '#42d9c8', '#ff8a5b', '#ff6d9a', '#b7e46d', '#c084fc', '#fbbf24', '#94a3b8'];
  const ICONS = {
    search: 'i-search', plus: 'i-plus', settings: 'i-settings', sun: 'i-sun', moon: 'i-moon',
    monitor: 'i-monitor', panel: 'i-panel', menu: 'i-menu', x: 'i-x', star: 'i-star',
    clock: 'i-clock', grid: 'i-grid', list: 'i-list', external: 'i-arrow-up-right', pencil: 'i-pencil',
    trash: 'i-trash', sparkles: 'i-sparkles', layers: 'i-layers', folder: 'i-folder', cloud: 'i-cloud',
    upload: 'i-upload', download: 'i-download', refresh: 'i-refresh', check: 'i-check',
    chevron: 'i-chevron-down', command: 'i-command', globe: 'i-globe', shield: 'i-shield',
    github: 'i-github', copy: 'i-copy', more: 'i-more', image: 'i-image', eye: 'i-eye',
    eyeOff: 'i-eye-off', logout: 'i-log-out', heart: 'i-heart', keyboard: 'i-keyboard',
    zap: 'i-zap', rotate: 'i-rotate'
  };

  const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#${ICONS[name] || name}"></use></svg>`;

  function uid(prefix = 's') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID().slice(0, 13);
    }
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeHex(value, fallback = '#8b7cff') {
    const raw = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return '#' + raw.slice(1).split('').map(char => char + char).join('').toLowerCase();
    }
    return fallback;
  }

  function hexToRgb(hex) {
    const value = normalizeHex(hex).slice(1);
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function rgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function categoryStyle(category) {
    const color = category ? category.color : '#8b7cff';
    return `--cat:${color};--cat-soft:${rgba(color, .14)};--cat-border:${rgba(color, .2)}`;
  }

  function domainOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
  }

  function normalizeUrl(value) {
    let url = String(value || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function looksLikeUrl(value) {
    const text = String(value || '').trim();
    return !/\s/.test(text) && /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(text);
  }

  function faviconFor(url) {
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`;
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - Number(timestamp);
    if (diff < 0) return '刚刚';
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < day * 7) return `${Math.floor(diff / day)} 天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function parseTags(value) {
    const seen = new Set();
    return String(value || '')
      .split(/[,，、]+/)
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .filter(tag => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_TAGS);
  }

  function seedData() {
    const now = Date.now();
    const categories = [
      { id: 'design', name: '设计灵感', color: '#c084fc' },
      { id: 'dev', name: '开发工具', color: '#7dd3fc' },
      { id: 'productivity', name: '效率办公', color: '#fbbf24' },
      { id: 'ai', name: 'AI 探索', color: '#67e8f9' },
      { id: 'media', name: '影像娱乐', color: '#fb7185' },
      { id: 'learn', name: '学习成长', color: '#86efac' }
    ];
    const sites = [
      { title: 'Figma', url: 'https://www.figma.com', description: '协作式界面设计工具，让想法快速成形。', categoryId: 'design', tags: ['设计', '协作'], favorite: true },
      { title: 'GitHub', url: 'https://github.com', description: '代码托管与开源协作社区，开发者的第二大脑。', categoryId: 'dev', tags: ['代码', '开源'], favorite: true },
      { title: 'Notion', url: 'https://www.notion.so', description: '文档、知识库与团队协作，一处安放所有灵感。', categoryId: 'productivity', tags: ['笔记', '协作'], favorite: true },
      { title: 'ChatGPT', url: 'https://chatgpt.com', description: 'AI 对话与创作助手，陪你思考每一个问题。', categoryId: 'ai', tags: ['AI', '写作'], favorite: true },
      { title: 'Dribbble', url: 'https://dribbble.com', description: '发现全球设计师的灵感、作品与趋势。', categoryId: 'design', tags: ['灵感', 'UI'], favorite: true },
      { title: 'Linear', url: 'https://linear.app', description: '为现代产品团队打造的项目管理工具。', categoryId: 'productivity', tags: ['项目管理', '效率'], favorite: true },
      { title: '少数派', url: 'https://sspai.com', description: '高效工作、品质生活与数字工具指南。', categoryId: 'learn', tags: ['效率', '阅读'], favorite: true },
      { title: 'Unsplash', url: 'https://unsplash.com', description: '高质量免费图片素材库，为创作寻找画面。', categoryId: 'design', tags: ['图片', '素材'], favorite: false },
      { title: 'Awwwards', url: 'https://www.awwwards.com', description: '网页设计灵感与全球获奖作品集合。', categoryId: 'design', tags: ['网页', '灵感'], favorite: false },
      { title: 'Behance', url: 'https://www.behance.net', description: '创意作品集与设计趋势，发现优秀创作者。', categoryId: 'design', tags: ['作品集', '灵感'], favorite: false },
      { title: 'Stack Overflow', url: 'https://stackoverflow.com', description: '开发者问答社区，疑难问题的高效解法。', categoryId: 'dev', tags: ['问答', '代码'], favorite: false },
      { title: 'MDN', url: 'https://developer.mozilla.org', description: 'Web 开发者的权威技术文档与指南。', categoryId: 'dev', tags: ['文档', 'Web'], favorite: false },
      { title: 'Vercel', url: 'https://vercel.com', description: '前端应用部署、托管与边缘网络平台。', categoryId: 'dev', tags: ['部署', '前端'], favorite: false },
      { title: 'Raycast', url: 'https://www.raycast.com', description: '重新定义效率的 macOS 启动器。', categoryId: 'productivity', tags: ['效率', '工具'], favorite: false },
      { title: 'Claude', url: 'https://claude.ai', description: '擅长长文本与深度思考的 AI 助手。', categoryId: 'ai', tags: ['AI', '对话'], favorite: false },
      { title: 'Perplexity', url: 'https://www.perplexity.ai', description: '带来源引用的 AI 搜索引擎。', categoryId: 'ai', tags: ['搜索', 'AI'], favorite: false },
      { title: 'Bilibili', url: 'https://www.bilibili.com', description: '年轻人的兴趣社区，知识也可以很有趣。', categoryId: 'media', tags: ['视频', '社区'], favorite: false },
      { title: 'YouTube', url: 'https://www.youtube.com', description: '全球视频与知识内容平台。', categoryId: 'media', tags: ['视频', '学习'], favorite: false },
      { title: 'Spotify', url: 'https://open.spotify.com', description: '音乐与播客流媒体，为专注配一段旋律。', categoryId: 'media', tags: ['音乐', '播客'], favorite: false },
      { title: 'Coursera', url: 'https://www.coursera.org', description: '来自全球高校与企业的在线课程。', categoryId: 'learn', tags: ['课程', '学习'], favorite: false }
    ].map((site, index) => ({
      ...site,
      id: 'seed-' + index,
      createdAt: now - index * 1000 * 60 * 60,
      lastVisited: index < 8 ? now - (index + 1) * 1000 * 60 * 45 : 0,
      visits: index < 8 ? 9 - index : 0
    }));
    return {
      app: 'orbit',
      version: APP_VERSION,
      settings: defaultSettings(),
      categories,
      sites,
      meta: { updatedAt: now }
    };
  }

  function defaultSettings() {
    return {
      theme: 'dark',
      accent: '#8b7cff',
      wallpaper: { mode: 'preset', value: 'aurora', image: '' },
      overlay: 35,
      wallpaperBlur: 0,
      glass: 56,
      radius: 22,
      animations: true,
      wallpaperMotion: true,
      density: 'comfortable',
      showDescriptions: true,
      showTags: true,
      layout: 'grid',
      sort: 'default',
      sidebarCollapsed: false
    };
  }

  function sanitizeSettings(input) {
    const base = defaultSettings();
    const settings = input && typeof input === 'object' ? input : {};
    const wallpaper = settings.wallpaper && typeof settings.wallpaper === 'object' ? settings.wallpaper : {};
    const mode = wallpaper.mode === 'image' && typeof wallpaper.image === 'string' && wallpaper.image.length > 6 ? 'image' : 'preset';
    const presetValues = ['aurora', 'dusk', 'ocean', 'ember', 'forest', 'mono'];
    return {
      theme: ['dark', 'light', 'system'].includes(settings.theme) ? settings.theme : base.theme,
      accent: normalizeHex(settings.accent, base.accent),
      wallpaper: {
        mode,
        value: presetValues.includes(wallpaper.value) ? wallpaper.value : 'aurora',
        image: mode === 'image' ? String(wallpaper.image) : ''
      },
      overlay: clamp(settings.overlay == null ? base.overlay : settings.overlay, 0, 80),
      wallpaperBlur: clamp(settings.wallpaperBlur == null ? base.wallpaperBlur : settings.wallpaperBlur, 0, 24),
      glass: clamp(settings.glass == null ? base.glass : settings.glass, 18, 92),
      radius: clamp(settings.radius == null ? base.radius : settings.radius, 8, 34),
      animations: settings.animations !== false,
      wallpaperMotion: settings.wallpaperMotion !== false,
      density: settings.density === 'compact' ? 'compact' : 'comfortable',
      showDescriptions: settings.showDescriptions !== false,
      showTags: settings.showTags !== false,
      layout: settings.layout === 'list' ? 'list' : 'grid',
      sort: ['default', 'recent', 'name', 'visits'].includes(settings.sort) ? settings.sort : 'default',
      sidebarCollapsed: settings.sidebarCollapsed === true
    };
  }

  function normalizeData(input, { strict = false } = {}) {
    if (!input || typeof input !== 'object') {
      if (strict) throw new Error('数据格式无效');
      return seedData();
    }
    const rawCategories = Array.isArray(input.categories) ? input.categories : [];
    const rawSites = Array.isArray(input.sites) ? input.sites : [];
    if (strict && (!rawCategories.length || !rawSites.length)) throw new Error('备份中缺少分类或网站数据');

    const categoryIds = new Set();
    let categories = rawCategories
      .filter(item => item && typeof item === 'object')
      .map((item, index) => {
        let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 60) : 'cat-' + index;
        while (categoryIds.has(id)) id += '-' + index;
        categoryIds.add(id);
        return {
          id,
          name: String(item.name || '未命名分类').trim().slice(0, 20) || '未命名分类',
          color: normalizeHex(item.color, CATEGORY_COLORS[index % CATEGORY_COLORS.length])
        };
      });
    if (!categories.length) {
      if (strict) throw new Error('备份中缺少分类数据');
      categories = seedData().categories;
    }

    const siteIds = new Set();
    const sites = rawSites
      .filter(item => item && typeof item === 'object')
      .map((item, index) => {
        const url = normalizeUrl(item.url);
        if (!url) return null;
        let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : 'site-' + index;
        while (siteIds.has(id)) id += '-' + index;
        siteIds.add(id);
        const categoryId = categoryIds.has(item.categoryId) ? item.categoryId : categories[0].id;
        const tags = Array.isArray(item.tags) ? item.tags : parseTags(item.tags);
        return {
          id,
          title: String(item.title || domainOf(url)).trim().slice(0, 40) || domainOf(url),
          url,
          description: String(item.description || '').trim().slice(0, 140),
          categoryId,
          tags: tags.map(tag => String(tag).trim().replace(/^#/, '').slice(0, 20)).filter(Boolean).slice(0, MAX_TAGS),
          favorite: item.favorite === true,
          createdAt: Number(item.createdAt) || Date.now() - index * 1000,
          lastVisited: Number(item.lastVisited) || 0,
          visits: Math.max(0, Number(item.visits) || 0)
        };
      })
      .filter(Boolean);
    if (strict && !sites.length) throw new Error('备份中没有有效的网站数据');

    return {
      app: 'orbit',
      version: APP_VERSION,
      settings: sanitizeSettings(input.settings),
      categories,
      sites,
      meta: { updatedAt: Number(input.meta && input.meta.updatedAt) || Date.now() }
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedData();
      return normalizeData(JSON.parse(raw));
    } catch {
      return seedData();
    }
  }

  function loadSyncState() {
    try {
      const raw = localStorage.getItem(SYNC_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null;
      return {
        token: parsed.token,
        gistId: typeof parsed.gistId === 'string' ? parsed.gistId : '',
        username: typeof parsed.username === 'string' ? parsed.username : '',
        auto: parsed.auto !== false,
        lastSync: Number(parsed.lastSync) || 0,
        lastError: ''
      };
    } catch {
      return null;
    }
  }

  let data = loadData();
  let sync = loadSyncState();
  let currentView = 'all';
  let activeCategory = null;
  let activeTag = null;
  let searchQuery = '';
  let editingSiteId = null;
  let paletteItems = [];
  let paletteIndex = 0;
  let confirmResolve = null;
  let lastFocusedElement = null;
  let saveTimer = null;
  let autoSyncTimer = null;
  let syncBusy = false;

  const els = {
    html: document.documentElement,
    body: document.body,
    sidebar: $('#sidebar'),
    sidebarScrim: $('#sidebarScrim'),
    content: $('#content'),
    searchInput: $('#searchInput'),
    searchClear: $('#searchClear'),
    siteGrid: $('#siteGrid'),
    emptyState: $('#emptyState'),
    emptyTitle: $('#emptyTitle'),
    emptyText: $('#emptyText'),
    emptyAddBtn: $('#emptyAddBtn'),
    pageTitle: $('#pageTitle'),
    pageEyebrow: $('#pageEyebrow'),
    libraryTitle: $('#libraryTitle'),
    sectionCount: $('#sectionCount'),
    sectionEyebrow: $('#sectionEyebrow'),
    activeFilter: $('#activeFilter'),
    activeFilterText: $('#activeFilterText'),
    tagFilters: $('#tagFilters'),
    categoryNav: $('#categoryNav'),
    navCountAll: $('#navCountAll'),
    navCountFavorites: $('#navCountFavorites'),
    sortSelect: $('#sortSelect'),
    statSites: $('#statSites'),
    statCategories: $('#statCategories'),
    statFavorites: $('#statFavorites'),
    greetingText: $('#greetingText'),
    clockText: $('#clockText'),
    clockNote: $('#clockNote'),
    dateText: $('#dateText'),
    heroMood: $('#heroMood'),
    siteModal: $('#siteModal'),
    siteForm: $('#siteForm'),
    siteModalTitle: $('#siteModalTitle'),
    siteId: $('#siteId'),
    siteTitle: $('#siteTitle'),
    siteUrl: $('#siteUrl'),
    siteCategory: $('#siteCategory'),
    siteTags: $('#siteTags'),
    siteDesc: $('#siteDesc'),
    siteFavorite: $('#siteFavorite'),
    siteSubmitBtn: $('#siteSubmitBtn'),
    deleteSiteBtn: $('#deleteSiteBtn'),
    categoryModal: $('#categoryModal'),
    categoryManagerList: $('#categoryManagerList'),
    categoryForm: $('#categoryForm'),
    categoryName: $('#categoryName'),
    categoryColor: $('#categoryColor'),
    categoryColorSwatches: $('#categoryColorSwatches'),
    settingsLayer: $('#settingsLayer'),
    confirmModal: $('#confirmModal'),
    confirmTitle: $('#confirmTitle'),
    confirmText: $('#confirmText'),
    confirmOk: $('#confirmOk'),
    confirmCancel: $('#confirmCancel'),
    confirmIcon: $('#confirmIcon'),
    shortcutModal: $('#shortcutModal'),
    paletteLayer: $('#paletteLayer'),
    paletteInput: $('#paletteInput'),
    paletteResults: $('#paletteResults'),
    toastStack: $('#toastStack'),
    wallpaperFile: $('#wallpaperFile'),
    importFile: $('#importFile'),
    syncPill: $('#openSync'),
    syncPillTitle: $('#syncPillTitle'),
    syncPillSub: $('#syncPillSub'),
    syncStatusIcon: $('#syncStatusIcon'),
    syncStatusTitle: $('#syncStatusTitle'),
    syncStatusDetail: $('#syncStatusDetail'),
    syncStatePill: $('#syncStatePill'),
    syncCard: $('#syncCard'),
    syncDisconnected: $('#syncDisconnected'),
    syncConnected: $('#syncConnected'),
    syncUsername: $('#syncUsername'),
    syncLastTime: $('#syncLastTime'),
    syncToken: $('#syncToken'),
    syncConnectBtn: $('#syncConnectBtn'),
    autoSyncToggle: $('#autoSyncToggle'),
    storageBar: $('#storageBar'),
    storageUsed: $('#storageUsed'),
    overlayRange: $('#overlayRange'),
    wallpaperBlurRange: $('#wallpaperBlurRange'),
    glassRange: $('#glassRange'),
    radiusRange: $('#radiusRange'),
    overlayOutput: $('#overlayOutput'),
    wallpaperBlurOutput: $('#wallpaperBlurOutput'),
    glassOutput: $('#glassOutput'),
    radiusOutput: $('#radiusOutput'),
    wallpaperStatus: $('#wallpaperStatus'),
    wallpaperStatusText: $('#wallpaperStatusText'),
    wallpaperUrl: $('#wallpaperUrl'),
    animationsToggle: $('#animationsToggle'),
    wallpaperMotionToggle: $('#wallpaperMotionToggle'),
    showDescriptionsToggle: $('#showDescriptionsToggle'),
    showTagsToggle: $('#showTagsToggle'),
    sidebarToggle: $('#sidebarToggle'),
    accentColorInput: $('#accentColorInput'),
    wallpaperPresets: $('#wallpaperPresets'),
    accentOptions: $('#accentOptions'),
    syncTokenToggle: $('#toggleToken')
  };

  function saveSyncState() {
    if (!sync) {
      localStorage.removeItem(SYNC_KEY);
      return;
    }
    try {
      const { token, gistId, username, auto, lastSync } = sync;
      localStorage.setItem(SYNC_KEY, JSON.stringify({ token, gistId, username, auto, lastSync }));
    } catch {
      /* ignore */
    }
  }

  function saveData(options = {}) {
    data.meta = { updatedAt: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      toast('保存失败，浏览器存储空间可能已满', 'error');
      return false;
    }
    updateStorageMeter();
    if (options.sync !== false) scheduleAutoSync();
    return true;
  }

  const queueSave = debounce(() => saveData(), 240);

  function getCategory(id) {
    return data.categories.find(category => category.id === id) || null;
  }

  function openMediaTab(tab) {
    openSettings(tab);
  }

  /* ---------------- Rendering ---------------- */
  function getCategoryCount(categoryId) {
    return data.sites.reduce((count, site) => count + (site.categoryId === categoryId ? 1 : 0), 0);
  }

  function currentViewLabel() {
    if (currentView === 'favorites') return '我的收藏';
    if (currentView === 'recent') return '最近访问';
    if (currentView === 'category') {
      const category = getCategory(activeCategory);
      return category ? category.name : '全部网站';
    }
    return searchQuery ? '搜索结果' : '全部网站';
  }

  function searchScore(site, query) {
    if (!query) return 0;
    const q = query.toLowerCase();
    const title = site.title.toLowerCase();
    const domain = domainOf(site.url).toLowerCase();
    const description = site.description.toLowerCase();
    const tags = site.tags.join(' ').toLowerCase();
    const category = (getCategory(site.categoryId)?.name || '').toLowerCase();
    let score = 0;
    if (title === q) score += 120;
    if (title.startsWith(q)) score += 70;
    if (title.includes(q)) score += 42;
    if (domain.startsWith(q)) score += 52;
    if (domain.includes(q)) score += 28;
    if (tags.includes(q)) score += 25;
    if (category.includes(q)) score += 20;
    if (description.includes(q)) score += 12;
    if (site.favorite && score > 0) score += 5;
    return score;
  }

  function filteredSites() {
    const query = searchQuery.trim().toLowerCase();
    let sites = data.sites.slice();
    if (currentView === 'favorites') sites = sites.filter(site => site.favorite);
    if (currentView === 'recent') sites = sites.filter(site => site.lastVisited > 0);
    if (currentView === 'category') sites = sites.filter(site => site.categoryId === activeCategory);
    if (activeTag) sites = sites.filter(site => site.tags.some(tag => tag.toLowerCase() === activeTag.toLowerCase()));
    if (query) sites = sites.filter(site => searchScore(site, query) > 0);

    const sort = data.settings.sort;
    if (query) {
      sites.sort((a, b) => searchScore(b, query) - searchScore(a, query));
      return sites;
    }
    if (currentView === 'recent') {
      sites.sort((a, b) => b.lastVisited - a.lastVisited);
      return sites;
    }
    if (sort === 'recent') {
      sites.sort((a, b) => b.lastVisited - a.lastVisited);
      return sites;
    }
    if (sort === 'name') {
      sites.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
      return sites;
    }
    if (sort === 'visits') {
      sites.sort((a, b) => b.visits - a.visits || b.lastVisited - a.lastVisited);
      return sites;
    }
    const order = new Map(data.sites.map((site, index) => [site.id, index]));
    sites.sort((a, b) => {
      if (currentView !== 'favorites' && a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return (order.get(a.id) || 0) - (order.get(b.id) || 0);
    });
    return sites;
  }

  function allTags() {
    const counts = new Map();
    data.sites.forEach(site => {
      site.tags.forEach(tag => {
        const key = tag.toLowerCase();
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { tag, count: 1 });
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));
  }

  function renderAll() {
    renderCategoryNav();
    renderTagFilters();
    renderLibrary();
    renderStats();
    renderSidebarCounts();
    renderViewControls();
    renderSyncUI();
    updateStorageMeter();
  }

  function renderSidebarCounts() {
    els.navCountAll.textContent = data.sites.length;
    els.navCountFavorites.textContent = data.sites.filter(site => site.favorite).length;
  }

  function renderCategoryNav() {
    const items = data.categories.map(category => {
      const count = getCategoryCount(category.id);
      const isActive = currentView === 'category' && activeCategory === category.id;
      return `<button class="category-item${isActive ? ' is-active' : ''}" data-category="${escapeHtml(category.id)}" style="${categoryStyle(category)}" title="${escapeHtml(category.name)}">
        <span class="category-dot"></span>
        <span class="category-name">${escapeHtml(category.name)}</span>
        <span class="category-count">${count}</span>
      </button>`;
    }).join('');
    els.categoryNav.innerHTML = items || '<div class="empty-filter-hint">还没有分类</div>';
  }

  function renderTagFilters() {
    const tags = allTags();
    if (!tags.length) {
      els.tagFilters.innerHTML = '';
      return;
    }
    const visible = tags.slice(0, 14);
    if (activeTag && !visible.some(item => item.tag.toLowerCase() === activeTag.toLowerCase())) {
      const found = tags.find(item => item.tag.toLowerCase() === activeTag.toLowerCase());
      if (found) visible.unshift(found);
    }
    els.tagFilters.innerHTML = visible.map(item => {
      const active = activeTag && item.tag.toLowerCase() === activeTag.toLowerCase();
      return `<button class="tag-chip${active ? ' is-active' : ''}" data-tag="${escapeHtml(item.tag)}">${escapeHtml(item.tag)}<span style="opacity:.45;font-size:7px">${item.count}</span></button>`;
    }).join('');
  }

  function renderViewControls() {
    $$('.nav-item[data-view]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.view === currentView);
    });
    $$('.filter-chip[data-view]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.view === currentView);
    });
    $$('.category-item').forEach(button => {
      button.classList.toggle('is-active', currentView === 'category' && button.dataset.category === activeCategory);
    });
    els.sortSelect.value = data.settings.sort;
    $$('.view-btn').forEach(button => {
      button.classList.toggle('is-active', button.dataset.layout === data.settings.layout);
    });
    els.siteGrid.classList.toggle('list-view', data.settings.layout === 'list');
    els.searchClear.hidden = !searchQuery;
    if (document.activeElement !== els.searchInput && els.searchInput.value !== searchQuery) {
      els.searchInput.value = searchQuery;
    }
  }

  function renderStats() {
    els.statSites.textContent = data.sites.length;
    els.statCategories.textContent = data.categories.length;
    els.statFavorites.textContent = data.sites.filter(site => site.favorite).length;
  }

  function updatePageHeading(sites) {
    const label = currentViewLabel();
    const category = activeCategory ? getCategory(activeCategory) : null;
    els.pageTitle.textContent = label;
    els.libraryTitle.firstChild.nodeValue = label + ' ';
    els.sectionCount.textContent = sites.length;
    els.pageEyebrow.textContent = currentView === 'favorites' ? 'STARRED' : currentView === 'recent' ? 'HISTORY' : currentView === 'category' ? 'CATEGORY' : searchQuery ? 'SEARCH' : 'COLLECTION';
    els.sectionEyebrow.textContent = currentView === 'favorites' ? 'FAVORITES' : currentView === 'recent' ? 'RECENTLY VISITED' : searchQuery ? 'RESULTS' : category ? category.name.toUpperCase() : 'LIBRARY';

    const filters = [];
    if (activeTag) filters.push('#' + activeTag);
    if (searchQuery) filters.push('“' + searchQuery + '”');
    if (filters.length) {
      els.activeFilterText.textContent = filters.join(' · ');
      els.activeFilter.hidden = false;
    } else {
      els.activeFilter.hidden = true;
    }
  }

  function cardTemplate(site, index) {
    const category = getCategory(site.categoryId);
    const color = category ? category.color : '#8b7cff';
    const tags = data.settings.showTags ? site.tags.slice(0, 2).map(tag => `<button class="card-tag" data-tag="${escapeHtml(tag)}" title="筛选标签 #${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('') : '';
    return `<article class="site-card${site.favorite ? ' has-favorite' : ''}" data-site-id="${escapeHtml(site.id)}" style="--i:${Math.min(index, 18)};${categoryStyle(category)}">
      <a class="site-card-link" href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${escapeHtml(site.title)}"></a>
      <div class="card-head">
        <span class="site-icon" aria-hidden="true">
          <img src="${escapeHtml(faviconFor(site.url))}" alt="" loading="lazy" referrerpolicy="no-referrer" />
          <span class="site-icon-fallback">${escapeHtml(site.title.slice(0, 1))}</span>
        </span>
        <div class="card-head-actions">
          <button class="card-action${site.favorite ? ' is-favorite' : ''}" data-action="favorite" aria-label="${site.favorite ? '取消收藏' : '收藏'} ${escapeHtml(site.title)}" title="${site.favorite ? '取消收藏' : '收藏'}">
            ${icon('star')}
          </button>
          <button class="card-action" data-action="edit" aria-label="编辑 ${escapeHtml(site.title)}" title="编辑网站">
            ${icon('pencil')}
          </button>
        </div>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(site.title)}<span class="external-mini" style="color:${color}">${icon('external')}</span></h3>
        <p>${escapeHtml(site.description || domainOf(site.url))}</p>
      </div>
      <div class="card-foot">
        <span class="category-chip"><i></i>${escapeHtml(category ? category.name : '未分类')}</span>
        <span class="card-tags">${tags}</span>
        <span class="card-domain">${escapeHtml(domainOf(site.url))}</span>
      </div>
      <span class="card-arrow" aria-hidden="true">${icon('external')}</span>
    </article>`;
  }

  function renderLibrary() {
    const sites = filteredSites();
    updatePageHeading(sites);

    if (!sites.length) {
      els.siteGrid.innerHTML = '';
      els.emptyState.hidden = false;
      const addCardVisible = false;
      if (searchQuery) {
        els.emptyTitle.textContent = '没有找到匹配的网站';
        els.emptyText.textContent = `试试其他关键词，或直接添加「${searchQuery}」。`;
        els.emptyAddBtn.hidden = false;
      } else if (currentView === 'favorites') {
        els.emptyTitle.textContent = '还没有收藏';
        els.emptyText.textContent = '在任意网站卡片上点击星标，它就会出现在这里。';
        els.emptyAddBtn.hidden = false;
      } else if (currentView === 'recent') {
        els.emptyTitle.textContent = '还没有访问记录';
        els.emptyText.textContent = '打开任意网站后，最近访问会在这里留下足迹。';
        els.emptyAddBtn.hidden = true;
      } else if (activeTag) {
        els.emptyTitle.textContent = '这个标签下还没有网站';
        els.emptyText.textContent = '换个标签看看，或在添加网站时使用这个标签。';
        els.emptyAddBtn.hidden = false;
      } else {
        els.emptyTitle.textContent = currentView === 'category' ? '这个分类还是一片空白' : '这里还是一片空白';
        els.emptyText.textContent = '收藏第一个网站，开始构建你的数字星图。';
        els.emptyAddBtn.hidden = false;
      }
      if (addCardVisible) { /* handled below */ }
      return;
    }

    els.emptyState.hidden = true;
    let html = sites.map(cardTemplate).join('');
    const allowAddCard = !searchQuery && !activeTag && ['all', 'category', 'favorites'].includes(currentView);
    if (allowAddCard) {
      html += `<button class="add-card" id="inlineAddCard" aria-label="添加网站">
        <span class="add-card-plus">${icon('plus')}</span>
        <span>添加新网站</span>
      </button>`;
    }
    els.siteGrid.innerHTML = html;
    bindFavicons(els.siteGrid);
  }

  function bindFavicons(root) {
    $$('.site-icon img', root).forEach(img => {
      const loaded = () => img.classList.add('is-loaded');
      if (img.complete && img.naturalWidth > 0) loaded();
      else img.addEventListener('load', loaded, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
    });
  }

  function updateStorageMeter() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '';
      const bytes = new Blob([raw]).size;
      const kb = bytes / 1024;
      const label = kb < 1024 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1)} MB`;
      els.storageUsed.textContent = '约 ' + label;
      els.storageBar.style.width = Math.min(100, (bytes / (5 * 1024 * 1024)) * 100).toFixed(1) + '%';
    } catch {
      els.storageUsed.textContent = '不可用';
    }
  }

  /* ---------------- Appearance ---------------- */
  function resolvedTheme() {
    if (data.settings.theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return data.settings.theme;
  }

  function setSliderFill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty('--pct', pct + '%');
  }

  function applySettings() {
    const settings = data.settings;
    const theme = resolvedTheme();
    els.html.dataset.theme = theme;
    els.html.dataset.wallpaper = settings.wallpaper.mode === 'preset' ? settings.wallpaper.value : 'aurora';
    els.html.dataset.motion = settings.animations ? 'on' : 'off';
    els.html.dataset.wallpaperMotion = settings.wallpaperMotion ? 'on' : 'off';
    els.html.dataset.density = settings.density;
    els.html.dataset.hideDescriptions = String(!settings.showDescriptions);
    els.html.dataset.hideTags = String(!settings.showTags);

    const accent = normalizeHex(settings.accent);
    const accentRgb = hexToRgb(accent);
    els.html.style.setProperty('--accent', accent);
    els.html.style.setProperty('--accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    els.html.style.setProperty('--accent-soft', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, .14)`);
    els.html.style.setProperty('--accent-softer', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, .08)`);
    els.html.style.setProperty('--accent-glow', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, .36)`);

    els.html.style.setProperty('--wp-overlay', (settings.overlay / 100).toFixed(2));
    els.html.style.setProperty('--wp-blur', settings.wallpaperBlur + 'px');
    els.html.style.setProperty('--glass-alpha', (settings.glass / 100).toFixed(2));
    els.html.style.setProperty('--radius', settings.radius + 'px');

    const imageLayer = $('#wallpaperImage');
    if (settings.wallpaper.mode === 'image' && settings.wallpaper.image) {
      els.html.classList.add('has-wallpaper-image');
      imageLayer.style.backgroundImage = `url("${settings.wallpaper.image.replace(/"/g, '%22')}")`;
      els.wallpaperStatus.hidden = false;
      els.wallpaperStatusText.textContent = settings.wallpaper.image.startsWith('data:') ? '已使用本地上传壁纸' : '已使用自定义图片壁纸';
    } else {
      els.html.classList.remove('has-wallpaper-image');
      imageLayer.style.backgroundImage = '';
      els.wallpaperStatus.hidden = true;
    }

    document.body.classList.toggle('sidebar-collapsed', settings.sidebarCollapsed);
    $('#sidebarToggle').checked = settings.sidebarCollapsed;

    const colorMeta = document.querySelector('meta[name="theme-color"]');
    if (colorMeta) colorMeta.setAttribute('content', theme === 'light' ? '#eef1fa' : '#080b14');

    $$('.theme-option[data-theme-value]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.themeValue === settings.theme);
    });
    $$('.wallpaper-preset').forEach(button => {
      const active = settings.wallpaper.mode === 'preset' && button.dataset.wallpaperValue === settings.wallpaper.value;
      button.classList.toggle('is-active', active);
    });
    $$('.accent-swatch').forEach(button => {
      button.classList.toggle('is-active', normalizeHex(button.dataset.accent) === accent);
    });
    els.accentColorInput.value = accent;

    const sliderMap = [
      [els.overlayRange, els.overlayOutput, settings.overlay, '%'],
      [els.wallpaperBlurRange, els.wallpaperBlurOutput, settings.wallpaperBlur, 'px'],
      [els.glassRange, els.glassOutput, settings.glass, '%'],
      [els.radiusRange, els.radiusOutput, settings.radius, 'px']
    ];
    sliderMap.forEach(([input, output, value, unit]) => {
      input.value = value;
      output.textContent = value + unit;
      setSliderFill(input);
    });

    els.animationsToggle.checked = settings.animations;
    els.wallpaperMotionToggle.checked = settings.wallpaperMotion;
    els.showDescriptionsToggle.checked = settings.showDescriptions;
    els.showTagsToggle.checked = settings.showTags;
    $$('.segment[data-density]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.density === settings.density);
    });
    $$('.view-btn').forEach(button => {
      button.classList.toggle('is-active', button.dataset.layout === settings.layout);
    });
    els.sortSelect.value = settings.sort;

    renderSyncPill();
  }

  function setThemeValue(value) {
    data.settings.theme = ['dark', 'light', 'system'].includes(value) ? value : 'dark';
    applySettings();
    saveData();
  }

  function toggleTheme() {
    const current = resolvedTheme();
    setThemeValue(current === 'dark' ? 'light' : 'dark');
    toast(current === 'dark' ? '已切换到浅色主题' : '已切换到深色主题', 'success');
  }

  function setAccent(value) {
    data.settings.accent = normalizeHex(value, data.settings.accent);
    applySettings();
    saveData();
  }

  /* ---------------- Clock ---------------- */
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const hours = now.getHours();
    let greeting = '晚上好';
    let note = '夜间';
    let mood = '愿灵感如星光降落';
    if (hours >= 5 && hours < 11) { greeting = '早上好'; note = '清晨'; mood = '新的一天，从一次探索开始'; }
    else if (hours >= 11 && hours < 13) { greeting = '中午好'; note = '午间'; mood = '给自己一点呼吸和灵感'; }
    else if (hours >= 13 && hours < 18) { greeting = '下午好'; note = '午后'; mood = '保持专注，也保持好奇'; }
    else if (hours >= 18 && hours < 23) { greeting = '晚上好'; note = '夜间'; mood = '愿灵感如星光降落'; }
    else { greeting = '夜深了'; note = '深夜'; mood = '别忘了留一点时间给休息'; }

    els.clockText.textContent = `${hh}:${mm}`;
    els.greetingText.textContent = greeting;
    els.clockNote.textContent = note;
    els.heroMood.textContent = mood;
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    els.dateText.textContent = `${now.getMonth() + 1}月${now.getDate()}日 · 星期${weekdays[now.getDay()]}`;
  }

  /* ---------------- Layers / focus ---------------- */
  function anyLayerOpen() {
    return $$('.modal-layer.is-open, .drawer-layer.is-open, .palette-layer.is-open').length > 0 || document.body.classList.contains('mobile-sidebar-open');
  }

  function syncBodyLock() {
    document.body.classList.toggle('no-scroll', anyLayerOpen());
  }

  function openLayer(element, focusSelector) {
    if (!element) return;
    lastFocusedElement = document.activeElement;
    element.classList.add('is-open');
    element.setAttribute('aria-hidden', 'false');
    syncBodyLock();
    if (focusSelector) {
      setTimeout(() => {
        const target = $(focusSelector, element);
        if (target) target.focus({ preventScroll: true });
      }, 120);
    }
  }

  function closeLayer(element, { restoreFocus = true } = {}) {
    if (!element) return;
    const wasOpen = element.classList.contains('is-open');
    element.classList.remove('is-open');
    element.setAttribute('aria-hidden', 'true');
    syncBodyLock();
    if (wasOpen && restoreFocus && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      setTimeout(() => lastFocusedElement.focus({ preventScroll: true }), 30);
    }
  }

  function openModal(id, focusSelector) {
    openLayer(document.getElementById(id), focusSelector);
  }

  function closeModal(id) {
    closeLayer(document.getElementById(id));
  }

  function closeAnyLayer() {
    if (els.paletteLayer.classList.contains('is-open')) return closePalette();
    if (els.confirmModal.classList.contains('is-open')) {
      resolveConfirm(false);
      closeLayer(els.confirmModal, { restoreFocus: false });
      return;
    }
    const order = [els.shortcutModal, els.siteModal, els.categoryModal, els.settingsLayer];
    for (const layer of order) {
      if (layer.classList.contains('is-open')) {
        closeLayer(layer);
        return;
      }
    }
    if (document.body.classList.contains('mobile-sidebar-open')) {
      document.body.classList.remove('mobile-sidebar-open');
      syncBodyLock();
    }
  }

  /* ---------------- Toasts / confirm ---------------- */
  function toast(message, type = 'default') {
    const node = document.createElement('div');
    node.className = 'toast toast-' + type;
    const iconName = type === 'success' ? 'check' : type === 'error' ? 'x' : 'sparkles';
    node.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><span>${escapeHtml(message)}</span>`;
    els.toastStack.appendChild(node);
    setTimeout(() => {
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 280);
    }, 3100);
  }

  function resolveConfirm(value) {
    if (confirmResolve) {
      const resolve = confirmResolve;
      confirmResolve = null;
      resolve(value);
    }
  }

  function confirmDialog({ title = '确认操作', text = '确定要继续吗？', okText = '确认', cancelText = '取消', danger = false }) {
    if (confirmResolve) resolveConfirm(false);
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmOk.textContent = okText;
    els.confirmCancel.textContent = cancelText;
    els.confirmIcon.classList.toggle('is-danger', danger);
    els.confirmOk.className = 'btn ' + (danger ? 'btn-danger-outline' : 'btn-primary');
    openModal('confirmModal', '#confirmOk');
    return new Promise(resolve => { confirmResolve = resolve; });
  }

  /* ---------------- Site form ---------------- */
  function populateCategorySelect(selectedId) {
    els.siteCategory.innerHTML = data.categories.map(category =>
      `<option value="${escapeHtml(category.id)}"${category.id === selectedId ? ' selected' : ''}>${escapeHtml(category.name)}</option>`
    ).join('');
  }

  function openSiteForm(site = null) {
    editingSiteId = site ? site.id : null;
    els.siteForm.reset();
    $$('.is-invalid', els.siteForm).forEach(node => node.classList.remove('is-invalid'));
    els.siteModalTitle.textContent = site ? '编辑网站' : '添加网站';
    els.siteModal.querySelector('.modal-eyebrow').textContent = site ? 'EDIT BOOKMARK' : 'NEW BOOKMARK';
    els.siteSubmitBtn.textContent = site ? '保存修改' : '保存网站';
    els.deleteSiteBtn.hidden = !site;
    els.siteId.value = site ? site.id : '';
    els.siteTitle.value = site ? site.title : '';
    els.siteUrl.value = site ? site.url : '';
    els.siteTags.value = site ? site.tags.join(', ') : '';
    els.siteDesc.value = site ? site.description : '';
    els.siteFavorite.checked = site ? site.favorite : currentView === 'favorites';
    const defaultCategory = site ? site.categoryId : (currentView === 'category' && activeCategory ? activeCategory : data.categories[0]?.id);
    populateCategorySelect(defaultCategory);
    openModal('siteModal', '#siteTitle');
  }

  function submitSiteForm(event) {
    event.preventDefault();
    const title = els.siteTitle.value.trim();
    const rawUrl = els.siteUrl.value.trim();
    const url = normalizeUrl(rawUrl);
    let invalid = false;
    els.siteTitle.classList.toggle('is-invalid', !title);
    els.siteUrl.classList.toggle('is-invalid', !url);
    if (!title) { invalid = true; els.siteTitle.focus(); }
    if (!url) { invalid = true; if (title) els.siteUrl.focus(); }
    if (invalid) {
      toast(url ? '请填写网站名称' : '请填写有效的网址，例如 example.com', 'error');
      return;
    }
    const categoryId = els.siteCategory.value || data.categories[0].id;
    const tags = parseTags(els.siteTags.value);
    const description = els.siteDesc.value.trim().slice(0, 140);
    const favorite = els.siteFavorite.checked;

    if (editingSiteId) {
      const site = data.sites.find(item => item.id === editingSiteId);
      if (!site) { closeModal('siteModal'); return; }
      Object.assign(site, { title, url, categoryId, tags, description, favorite });
      toast('网站已更新', 'success');
    } else {
      const site = {
        id: uid('site'),
        title,
        url,
        categoryId,
        tags,
        description,
        favorite,
        createdAt: Date.now(),
        lastVisited: 0,
        visits: 0
      };
      data.sites.unshift(site);
      toast('网站已添加到你的星图', 'success');
    }
    saveData();
    closeModal('siteModal');
    renderAll();
  }

  async function deleteEditingSite() {
    if (!editingSiteId) return;
    const site = data.sites.find(item => item.id === editingSiteId);
    if (!site) return;
    const confirmed = await confirmDialog({
      title: '删除这个网站？',
      text: `「${site.title}」将从你的导航中移除，此操作不可撤销。`,
      okText: '删除',
      danger: true
    });
    if (!confirmed) return;
    data.sites = data.sites.filter(item => item.id !== editingSiteId);
    saveData();
    closeModal('siteModal');
    renderAll();
    toast('网站已删除');
  }

  /* ---------------- Categories ---------------- */
  function renderCategoryManager() {
    els.categoryManagerList.innerHTML = data.categories.map(category => {
      const count = getCategoryCount(category.id);
      return `<div class="category-manage-item" style="${categoryStyle(category)}">
        <span class="category-manage-dot"></span>
        <span class="category-manage-name">${escapeHtml(category.name)}</span>
        <span class="category-manage-count">${count} 个网站</span>
        <button class="category-manage-delete" data-delete-category="${escapeHtml(category.id)}" aria-label="删除分类 ${escapeHtml(category.name)}" title="删除分类">${icon('trash')}</button>
      </div>`;
    }).join('');
    els.categoryName.value = '';
    setCategoryColor(CATEGORY_COLORS[Math.floor(Math.random() * 6)]);
  }

  function setCategoryColor(color) {
    const normalized = normalizeHex(color, CATEGORY_COLORS[0]);
    els.categoryColor.value = normalized;
    $$('.color-swatch', els.categoryColorSwatches).forEach(button => {
      button.classList.toggle('is-active', button.dataset.color === normalized);
    });
  }

  function openCategoryManager() {
    renderCategoryManager();
    openModal('categoryModal', '#categoryName');
  }

  function submitCategoryForm(event) {
    event.preventDefault();
    const name = els.categoryName.value.trim();
    if (!name) {
      els.categoryName.classList.add('is-invalid');
      els.categoryName.focus();
      return;
    }
    if (data.categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
      toast('这个分类名称已经存在', 'error');
      return;
    }
    data.categories.push({ id: uid('cat'), name: name.slice(0, 20), color: normalizeHex(els.categoryColor.value, CATEGORY_COLORS[0]) });
    saveData();
    renderAll();
    renderCategoryManager();
    toast('分类已创建', 'success');
  }

  async function deleteCategory(categoryId) {
    const category = getCategory(categoryId);
    if (!category) return;
    if (data.categories.length <= 1) {
      toast('至少保留一个分类', 'error');
      return;
    }
    const count = getCategoryCount(categoryId);
    let fallback = data.categories.find(item => item.id !== categoryId);
    if (count > 0) {
      const confirmed = await confirmDialog({
        title: '删除这个分类？',
        text: `「${category.name}」下有 ${count} 个网站，它们会被移动到「${fallback.name}」。`,
        okText: '删除分类',
        danger: true
      });
      if (!confirmed) return;
      data.sites.forEach(site => {
        if (site.categoryId === categoryId) site.categoryId = fallback.id;
      });
    } else {
      const confirmed = await confirmDialog({
        title: '删除这个分类？',
        text: `「${category.name}」是空分类，可以安全移除。`,
        okText: '删除',
        danger: true
      });
      if (!confirmed) return;
    }
    data.categories = data.categories.filter(item => item.id !== categoryId);
    if (activeCategory === categoryId) {
      currentView = 'all';
      activeCategory = null;
    }
    saveData();
    renderAll();
    renderCategoryManager();
    toast('分类已删除');
  }

  /* ---------------- Filtering / navigation ---------------- */
  function setView(view) {
    if (!['all', 'favorites', 'recent'].includes(view)) return;
    currentView = view;
    activeCategory = null;
    activeTag = null;
    searchQuery = '';
    els.searchInput.value = '';
    renderAll();
    closeMobileSidebar();
  }

  function setCategory(categoryId) {
    if (!getCategory(categoryId)) return;
    currentView = 'category';
    activeCategory = categoryId;
    activeTag = null;
    searchQuery = '';
    els.searchInput.value = '';
    renderAll();
    closeMobileSidebar();
  }

  function setTag(tag) {
    const normalized = String(tag || '').trim();
    if (!normalized) return;
    activeTag = activeTag && activeTag.toLowerCase() === normalized.toLowerCase() ? null : normalized;
    if (!data.categories.some(category => category.id === activeCategory) && currentView === 'category') {
      currentView = 'all';
      activeCategory = null;
    }
    renderAll();
  }

  function clearFilters() {
    activeTag = null;
    searchQuery = '';
    els.searchInput.value = '';
    renderAll();
  }

  function openSite(site) {
    if (!site) return;
    site.lastVisited = Date.now();
    site.visits = (site.visits || 0) + 1;
    saveData();
    window.open(site.url, '_blank', 'noopener,noreferrer');
    if (currentView === 'recent' || data.settings.sort === 'recent' || data.settings.sort === 'visits') {
      setTimeout(renderLibrary, 80);
    }
  }

  function closeMobileSidebar() {
    document.body.classList.remove('mobile-sidebar-open');
    syncBodyLock();
  }

  function toggleSidebar() {
    if (window.innerWidth <= 920) {
      document.body.classList.toggle('mobile-sidebar-open');
      syncBodyLock();
      return;
    }
    data.settings.sidebarCollapsed = !data.settings.sidebarCollapsed;
    applySettings();
    saveData();
  }

  /* ---------------- Settings ---------------- */
  function activateSettingsTab(tab) {
    const allowed = ['appearance', 'layout', 'data'];
    const target = allowed.includes(tab) ? tab : 'appearance';
    $$('.drawer-tab').forEach(button => {
      const active = button.dataset.tab === target;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('.settings-panel').forEach(panel => {
      panel.classList.toggle('is-active', panel.dataset.panel === target);
    });
  }

  function openSettings(tab = 'appearance') {
    activateSettingsTab(tab);
    els.syncToken.value = sync ? sync.token : '';
    renderSyncUI();
    updateStorageMeter();
    openLayer(els.settingsLayer, '.drawer-head .icon-btn');
  }

  function closeSettings() {
    closeLayer(els.settingsLayer);
  }

  function applyWallpaperImage(image, { persist = true, message = '壁纸已更新' } = {}) {
    data.settings.wallpaper.mode = 'image';
    data.settings.wallpaper.image = image;
    applySettings();
    if (persist) saveData();
    if (message) toast(message, 'success');
  }

  function resetWallpaper() {
    data.settings.wallpaper.mode = 'preset';
    data.settings.wallpaper.image = '';
    if (!['aurora', 'dusk', 'ocean', 'ember', 'forest', 'mono'].includes(data.settings.wallpaper.value)) {
      data.settings.wallpaper.value = 'aurora';
    }
    applySettings();
    saveData();
    toast('已恢复预设壁纸');
  }

  function applyWallpaperUrl() {
    const raw = els.wallpaperUrl.value.trim();
    if (!raw) return;
    let url;
    try {
      url = new URL(raw);
    } catch {
      toast('请输入有效的图片链接', 'error');
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      toast('图片链接需要以 http(s) 开头', 'error');
      return;
    }
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      applyWallpaperImage(url.href, { message: '已应用图片壁纸' });
      els.wallpaperUrl.value = '';
    };
    probe.onerror = () => toast('图片加载失败，请检查链接是否可访问', 'error');
    probe.src = url.href;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function processWallpaperFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error');
      return;
    }
    if (file.size > 14 * 1024 * 1024) {
      toast('图片不能超过 14 MB', 'error');
      return;
    }
    try {
      toast('正在处理壁纸…');
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      const maxWidth = 2200;
      const maxHeight = 1500;
      let width = image.naturalWidth || image.width;
      let height = image.naturalHeight || image.height;
      const ratio = Math.min(1, maxWidth / width, maxHeight / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#080b14';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      let output = canvas.toDataURL('image/jpeg', .8);
      if (output.length > 3.4 * 1024 * 1024) {
        canvas.width = Math.round(width * .72);
        canvas.height = Math.round(height * .72);
        const resized = canvas.getContext('2d');
        resized.fillStyle = '#080b14';
        resized.fillRect(0, 0, canvas.width, canvas.height);
        resized.drawImage(image, 0, 0, canvas.width, canvas.height);
        output = canvas.toDataURL('image/jpeg', .74);
      }
      applyWallpaperImage(output, { message: '本地壁纸已应用' });
    } catch {
      toast('图片处理失败，请换一张试试', 'error');
    } finally {
      els.wallpaperFile.value = '';
    }
  }

  function exportData() {
    const payload = {
      app: 'orbit',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: data.settings,
      categories: data.categories,
      sites: data.sites,
      meta: data.meta
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `orbit-nav-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('数据备份已导出', 'success');
  }

  async function importDataFromFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = normalizeData(parsed, { strict: true });
      const confirmed = await confirmDialog({
        title: '导入这份备份？',
        text: `备份中包含 ${imported.sites.length} 个网站和 ${imported.categories.length} 个分类。当前数据将被覆盖。`,
        okText: '导入并覆盖'
      });
      if (!confirmed) return;
      data = imported;
      saveData({ sync: false });
      applySettings();
      renderAll();
      closeSettings();
      toast('备份已导入', 'success');
    } catch (error) {
      toast(error && error.message ? `导入失败：${error.message}` : '导入失败，文件格式不正确', 'error');
    } finally {
      els.importFile.value = '';
    }
  }

  async function resetAllData() {
    const confirmed = await confirmDialog({
      title: '恢复初始状态？',
      text: '所有网站、分类和个性化设置都会被清除，云同步连接也会断开。此操作不可撤销。',
      okText: '恢复初始状态',
      danger: true
    });
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_KEY);
    sync = null;
    data = seedData();
    currentView = 'all';
    activeCategory = null;
    activeTag = null;
    searchQuery = '';
    els.searchInput.value = '';
    saveData({ sync: false });
    applySettings();
    renderAll();
    renderSyncUI();
    closeSettings();
    toast('已恢复到初始状态');
  }

  /* ---------------- Cloud sync ---------------- */
  function isSyncConnected() {
    return Boolean(sync && sync.token && sync.gistId);
  }

  function syncHeaders(token) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function githubRequest(path, token, options = {}) {
    const response = await fetch('https://api.github.com' + path, {
      ...options,
      headers: {
        ...syncHeaders(token),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      let message = `GitHub 请求失败 (${response.status})`;
      try {
        const body = await response.json();
        if (body && body.message) message = body.message;
      } catch { /* ignore */ }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function syncPayload() {
    return {
      app: 'orbit',
      version: APP_VERSION,
      settings: data.settings,
      categories: data.categories,
      sites: data.sites,
      meta: { updatedAt: Date.now() }
    };
  }

  function setSyncBusy(busy, label) {
    syncBusy = busy;
    if (els.syncConnectBtn) {
      els.syncConnectBtn.disabled = busy;
      els.syncConnectBtn.textContent = busy ? (label || '连接中…') : '连接';
    }
  }

  async function connectSync() {
    if (syncBusy) return;
    const token = els.syncToken.value.trim();
    if (!token) {
      toast('请先粘贴 GitHub 令牌', 'error');
      els.syncToken.focus();
      return;
    }
    setSyncBusy(true, '验证中…');
    try {
      const user = await githubRequest('/user', token);
      let gistId = sync && sync.token === token && sync.gistId ? sync.gistId : '';
      let cloudGist = null;
      if (gistId) {
        try {
          cloudGist = await githubRequest(`/gists/${gistId}`, token);
        } catch (error) {
          if (error.status !== 404) throw error;
          gistId = '';
        }
      }
      if (!gistId) {
        const gists = await githubRequest('/gists?per_page=100&sort=updated', token);
        cloudGist = Array.isArray(gists) ? gists.find(item => item.files && item.files[GIST_FILE]) || null : null;
        if (cloudGist) gistId = cloudGist.id;
      }

      let importedCloud = false;
      if (cloudGist) {
        const file = cloudGist.files && cloudGist.files[GIST_FILE];
        let cloudData = null;
        try {
          const content = file.truncated ? (await githubRequest(`/gists/${gistId}`, token)).files[GIST_FILE].content : file.content;
          cloudData = normalizeData(JSON.parse(content), { strict: true });
        } catch { /* invalid cloud backup */ }
        if (cloudData) {
          const confirmed = await confirmDialog({
            title: '发现云端备份',
            text: `云端有 ${cloudData.sites.length} 个网站、${cloudData.categories.length} 个分类。是否用云端数据覆盖当前设备？选择「保留本地」则先保持当前数据，之后可手动上传或拉取。`,
            okText: '拉取云端',
            cancelText: '保留本地'
          });
          if (confirmed) {
            data = cloudData;
            importedCloud = true;
          }
        }
      }

      const sameGist = Boolean(sync && gistId && sync.gistId === gistId);
      sync = {
        token,
        gistId,
        username: user.login || '',
        auto: importedCloud ? true : (sameGist ? sync.auto : (cloudGist ? false : true)),
        lastSync: Date.now(),
        lastError: ''
      };

      if (!gistId) {
        const created = await githubRequest('/gists', token, {
          method: 'POST',
          body: JSON.stringify({
            description: GIST_DESCRIPTION,
            public: false,
            files: { [GIST_FILE]: { content: JSON.stringify(syncPayload(), null, 2) } }
          })
        });
        sync.gistId = created.id;
        sync.lastSync = Date.now();
        toast('已创建私有云端备份', 'success');
      } else if (importedCloud) {
        saveData({ sync: false });
        applySettings();
        renderAll();
        toast('云端数据已同步到本机', 'success');
      } else {
        toast('云同步已连接，可手动上传或拉取', 'success');
      }

      saveSyncState();
      saveData({ sync: false });
      renderSyncUI();
      renderSyncPill();
      els.syncToken.value = token;
    } catch (error) {
      const hint = error.status === 401 ? '令牌无效或已过期' : error.status === 403 ? '令牌缺少 gist 权限或请求过于频繁' : error.message;
      toast('连接失败：' + hint, 'error');
    } finally {
      setSyncBusy(false);
    }
  }

  async function pushSync(manual = true) {
    if (!isSyncConnected()) {
      if (manual) toast('请先连接云同步', 'error');
      return false;
    }
    if (syncBusy) return false;
    if (manual) toast('正在上传到云端…');
    try {
      await githubRequest(`/gists/${sync.gistId}`, sync.token, {
        method: 'PATCH',
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          files: { [GIST_FILE]: { content: JSON.stringify(syncPayload(), null, 2) } }
        })
      });
      sync.lastSync = Date.now();
      sync.lastError = '';
      saveSyncState();
      renderSyncUI();
      renderSyncPill();
      if (manual) toast('本地数据已上传到云端', 'success');
      return true;
    } catch (error) {
      sync.lastError = error.message || '同步失败';
      renderSyncUI();
      renderSyncPill();
      if (manual) toast('上传失败：' + sync.lastError, 'error');
      return false;
    }
  }

  async function pullSync(manual = true) {
    if (!isSyncConnected()) {
      if (manual) toast('请先连接云同步', 'error');
      return false;
    }
    if (syncBusy) return false;
    if (manual) toast('正在读取云端数据…');
    try {
      const gist = await githubRequest(`/gists/${sync.gistId}`, sync.token);
      const file = gist.files && gist.files[GIST_FILE];
      if (!file) throw new Error('云端备份文件不存在');
      const content = file.truncated ? (await githubRequest(`/gists/${gist.id}`, sync.token)).files[GIST_FILE].content : file.content;
      const cloudData = normalizeData(JSON.parse(content), { strict: true });
      if (manual) {
        const confirmed = await confirmDialog({
          title: '拉取云端数据？',
          text: `云端备份包含 ${cloudData.sites.length} 个网站。当前设备上的导航数据将被覆盖。`,
          okText: '拉取并覆盖'
        });
        if (!confirmed) return false;
      }
      data = cloudData;
      saveData({ sync: false });
      applySettings();
      renderAll();
      sync.lastSync = Date.now();
      sync.lastError = '';
      saveSyncState();
      renderSyncUI();
      if (manual) toast('云端数据已同步到本机', 'success');
      return true;
    } catch (error) {
      sync.lastError = error.message || '拉取失败';
      renderSyncUI();
      if (manual) toast('拉取失败：' + sync.lastError, 'error');
      return false;
    }
  }

  async function disconnectSync() {
    const confirmed = await confirmDialog({
      title: '断开云同步？',
      text: '令牌会从当前浏览器移除。云端备份不会被删除，之后仍可重新连接。',
      okText: '断开连接',
      danger: true
    });
    if (!confirmed) return;
    sync = null;
    localStorage.removeItem(SYNC_KEY);
    els.syncToken.value = '';
    renderSyncUI();
    renderSyncPill();
    toast('云同步已断开');
  }

  function scheduleAutoSync() {
    if (!isSyncConnected() || !sync.auto) return;
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => { pushSync(false); }, 1600);
  }

  function renderSyncUI() {
    if (!els.syncCard) return;
    const connected = isSyncConnected();
    els.syncCard.classList.toggle('is-connected', connected);
    els.syncDisconnected.hidden = connected;
    els.syncConnected.hidden = !connected;
    els.syncStatusIcon.innerHTML = icon(connected ? 'check' : 'cloud');
    if (connected) {
      els.syncStatusTitle.textContent = sync.lastError ? '同步遇到问题' : '已连接 GitHub Gist';
      els.syncStatusDetail.textContent = sync.lastError || '私有备份，自动保持最新';
      els.syncStatePill.textContent = sync.lastError ? '异常' : '已同步';
      els.syncUsername.textContent = '@' + (sync.username || 'github');
      els.syncLastTime.textContent = sync.lastSync ? '上次同步 ' + formatRelativeTime(sync.lastSync) : '尚未同步';
      els.autoSyncToggle.checked = Boolean(sync.auto);
    } else {
      els.syncStatusTitle.textContent = '尚未连接';
      els.syncStatusDetail.textContent = '数据只保存在当前浏览器中';
      els.syncStatePill.textContent = '本地';
    }
  }

  function renderSyncPill() {
    if (!els.syncPill) return;
    const connected = isSyncConnected();
    els.syncPill.classList.toggle('is-connected', connected);
    els.syncPillTitle.textContent = connected ? (sync.lastError ? '同步异常' : '云端已连接') : '本地模式';
    els.syncPillSub.textContent = connected ? '@' + (sync.username || 'github') : '数据已安全保存';
    els.syncPill.title = connected ? '管理云同步' : '打开跨设备同步';
  }

  /* ---------------- Command palette ---------------- */
  function paletteActionItem(id, title, subtitle, iconName, action) {
    return {
      id,
      title,
      subtitle,
      iconHtml: icon(iconName),
      action
    };
  }

  function buildPaletteGroups(query) {
    const q = query.trim().toLowerCase();
    const actions = [
      paletteActionItem('add', '添加网站', '收藏一个新的数字入口', 'plus', () => { closePalette(); openSiteForm(); }),
      paletteActionItem('appearance', '个性化设置', '壁纸、主题与玻璃质感', 'settings', () => { closePalette(); openSettings('appearance'); }),
      paletteActionItem('sync', '云同步', '通过 GitHub Gist 跨设备同步', 'cloud', () => { closePalette(); openSettings('data'); }),
      paletteActionItem('theme', '切换主题', '在深色与浅色之间切换', resolvedTheme() === 'dark' ? 'sun' : 'moon', () => { closePalette(); toggleTheme(); }),
      paletteActionItem('categories', '管理分类', '新增、删除或整理分类标签', 'layers', () => { closePalette(); openCategoryManager(); }),
      paletteActionItem('shortcuts', '键盘快捷键', '查看所有快捷操作', 'keyboard', () => { closePalette(); openModal('shortcutModal'); })
    ].filter(item => !q || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q));

    const groups = [];
    if (looksLikeUrl(query)) {
      const url = normalizeUrl(query);
      if (url) {
        groups.push({
          label: '直接打开',
          items: [{
            id: 'url-' + url,
            title: '打开 ' + domainOf(url),
            subtitle: url,
            iconHtml: icon('globe'),
            action: () => { closePalette(); window.open(url, '_blank', 'noopener,noreferrer'); }
          }]
        });
      }
    }
    if (actions.length) groups.push({ label: '快捷操作', items: actions });

    const categoryMatches = data.categories
      .map(category => {
        const text = category.name.toLowerCase();
        let score = 0;
        if (q && text.includes(q)) score += 50;
        if (q && text.startsWith(q)) score += 30;
        return { category, score };
      })
      .filter(item => !q || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, q ? 3 : 0)
      .map(({ category }) => ({
        id: 'cat-' + category.id,
        title: category.name,
        subtitle: getCategoryCount(category.id) + ' 个网站',
        iconHtml: `<span style="display:block;width:9px;height:9px;border-radius:50%;background:${category.color};box-shadow:0 0 9px ${rgba(category.color, .7)}"></span>`,
        action: () => { closePalette(); setCategory(category.id); }
      }));
    if (categoryMatches.length) groups.push({ label: '分类', items: categoryMatches });

    let siteMatches;
    if (q) {
      siteMatches = data.sites
        .map(site => ({ site, score: searchScore(site, q) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ site }) => paletteSiteItem(site));
    } else {
      siteMatches = data.sites
        .filter(site => site.favorite)
        .slice(0, 6)
        .map(site => paletteSiteItem(site));
    }
    if (siteMatches.length) groups.push({ label: q ? '匹配网站' : '常去网站', items: siteMatches });
    return groups;
  }

  function paletteSiteItem(site) {
    const category = getCategory(site.categoryId);
    const color = category ? category.color : '#8b7cff';
    return {
      id: 'site-' + site.id,
      title: site.title,
      subtitle: domainOf(site.url) + (site.description ? ' · ' + site.description : ''),
      iconHtml: `<span style="display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:${rgba(color, .16)};color:${color};font-size:10px;font-weight:800">${escapeHtml(site.title.slice(0, 1))}</span>`,
      action: () => { closePalette(); openSite(site); }
    };
  }

  function openPalette() {
    if (els.paletteLayer.classList.contains('is-open')) return;
    lastFocusedElement = document.activeElement;
    els.paletteInput.value = '';
    paletteIndex = 0;
    renderPalette();
    openLayer(els.paletteLayer);
    setTimeout(() => els.paletteInput.focus({ preventScroll: true }), 70);
  }

  function closePalette() {
    if (!els.paletteLayer.classList.contains('is-open')) return;
    closeLayer(els.paletteLayer);
  }

  function renderPalette() {
    const query = els.paletteInput.value;
    const groups = buildPaletteGroups(query);
    paletteItems = groups.flatMap(group => group.items);
    if (!paletteItems.length) {
      els.paletteResults.innerHTML = `<div class="palette-empty"><strong>没有找到相关结果</strong><span>换个关键词，或直接输入一个网址试试</span></div>`;
      return;
    }
    if (paletteIndex >= paletteItems.length) paletteIndex = paletteItems.length - 1;
    if (paletteIndex < 0) paletteIndex = 0;
    let index = 0;
    let html = '';
    groups.forEach(group => {
      html += `<div class="palette-section-label">${escapeHtml(group.label)}</div>`;
      group.items.forEach(item => {
        const current = index;
        html += `<button class="palette-item${current === paletteIndex ? ' is-selected' : ''}" data-palette-index="${current}">
          <span class="palette-item-icon">${item.iconHtml}</span>
          <span class="palette-item-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle)}</small></span>
          ${current === paletteIndex ? '<span class="palette-item-hint">↵</span>' : ''}
        </button>`;
        index += 1;
      });
    });
    els.paletteResults.innerHTML = html;
  }

  function updatePaletteSelection() {
    $$('.palette-item', els.paletteResults).forEach((item, index) => {
      const selected = index === paletteIndex;
      item.classList.toggle('is-selected', selected);
      const hint = $('.palette-item-hint', item);
      if (selected && !hint) {
        const span = document.createElement('span');
        span.className = 'palette-item-hint';
        span.textContent = '↵';
        item.appendChild(span);
      } else if (!selected && hint) {
        hint.remove();
      }
    });
    const selected = $('.palette-item.is-selected', els.paletteResults);
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  function executePaletteItem(index) {
    const item = paletteItems[index];
    if (!item) return;
    item.action();
  }

  function handlePaletteKeydown(event) {
    if (!els.paletteLayer.classList.contains('is-open')) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!paletteItems.length) return;
      paletteIndex = (paletteIndex + 1) % paletteItems.length;
      updatePaletteSelection();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!paletteItems.length) return;
      paletteIndex = (paletteIndex - 1 + paletteItems.length) % paletteItems.length;
      updatePaletteSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      executePaletteItem(paletteIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  }

  /* ---------------- Event bindings ---------------- */
  function bindEvents() {
    $$('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    $$('.filter-chip[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

    els.categoryNav.addEventListener('click', event => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      setCategory(button.dataset.category);
    });

    els.tagFilters.addEventListener('click', event => {
      const button = event.target.closest('[data-tag]');
      if (!button) return;
      setTag(button.dataset.tag);
    });

    els.searchInput.addEventListener('input', () => {
      searchQuery = els.searchInput.value;
      renderShortSearchState();
    });
    els.searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const sites = filteredSites();
        if (sites.length) openSite(sites[0]);
        else if (looksLikeUrl(searchQuery)) {
          const url = normalizeUrl(searchQuery);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
      if (event.key === 'Escape') {
        searchQuery = '';
        els.searchInput.value = '';
        renderShortSearchState();
        els.searchInput.blur();
      }
    });
    els.searchClear.addEventListener('click', () => {
      searchQuery = '';
      els.searchInput.value = '';
      els.searchInput.focus();
      renderShortSearchState();
    });
    $('#openPaletteFromSearch').addEventListener('click', openPalette);

    $('#clearFilter').addEventListener('click', clearFilters);

    els.siteGrid.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-action]');
      const article = event.target.closest('.site-card');
      if (actionButton && article) {
        event.preventDefault();
        const site = data.sites.find(item => item.id === article.dataset.siteId);
        if (!site) return;
        if (actionButton.dataset.action === 'favorite') {
          site.favorite = !site.favorite;
          saveData();
          renderAll();
          toast(site.favorite ? `已收藏「${site.title}」` : `已取消收藏「${site.title}」`, 'success');
        } else if (actionButton.dataset.action === 'edit') {
          event.stopPropagation();
          openSiteForm(site);
        }
        return;
      }
      const tagButton = event.target.closest('[data-tag]');
      if (tagButton) {
        event.preventDefault();
        setTag(tagButton.dataset.tag);
        return;
      }
      if (event.target.closest('#inlineAddCard')) {
        openSiteForm();
        return;
      }
      const link = event.target.closest('.site-card-link');
      if (link && article) {
        const site = data.sites.find(item => item.id === article.dataset.siteId);
        if (site) trackVisit(site);
      }
    });

    els.siteGrid.addEventListener('pointermove', event => {
      const card = event.target.closest('.site-card');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
    });

    $('#openAddSite').addEventListener('click', () => openSiteForm());
    $('#emptyAddBtn').addEventListener('click', () => openSiteForm());
    $('#mobileAdd').addEventListener('click', () => openSiteForm());
    $('#openCategoryManager').addEventListener('click', openCategoryManager);
    $('#openSettings').addEventListener('click', () => openSettings('appearance'));
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#sidebarCollapse').addEventListener('click', toggleSidebar);
    $('#mobileMenu').addEventListener('click', () => {
      document.body.classList.toggle('mobile-sidebar-open');
      syncBodyLock();
    });
    els.sidebarScrim.addEventListener('click', closeMobileSidebar);
    $('#openSync').addEventListener('click', () => openSettings('data'));
    $('#footerShortcuts').addEventListener('click', () => openModal('shortcutModal'));

    $$('.drawer-tab').forEach(button => button.addEventListener('click', () => activateSettingsTab(button.dataset.tab)));
    $$('.theme-option[data-theme-value]').forEach(button => button.addEventListener('click', () => setThemeValue(button.dataset.themeValue)));

    els.wallpaperPresets.addEventListener('click', event => {
      const button = event.target.closest('[data-wallpaper-value]');
      if (!button) return;
      data.settings.wallpaper = { mode: 'preset', value: button.dataset.wallpaperValue, image: '' };
      applySettings();
      saveData();
      toast('壁纸已切换');
    });
    $('#uploadWallpaper').addEventListener('click', () => els.wallpaperFile.click());
    els.wallpaperFile.addEventListener('change', () => processWallpaperFile(els.wallpaperFile.files[0]));
    $('#applyWallpaperUrl').addEventListener('click', applyWallpaperUrl);
    els.wallpaperUrl.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); applyWallpaperUrl(); }
    });
    $('#resetWallpaper').addEventListener('click', resetWallpaper);

    const bindRange = (input, output, key, unit) => {
      input.addEventListener('input', () => {
        const value = Number(input.value);
        data.settings[key] = value;
        output.textContent = value + unit;
        setSliderFill(input);
        applySettings();
        queueSave();
      });
      input.addEventListener('change', () => saveData());
    };
    bindRange(els.overlayRange, els.overlayOutput, 'overlay', '%');
    bindRange(els.wallpaperBlurRange, els.wallpaperBlurOutput, 'wallpaperBlur', 'px');
    bindRange(els.glassRange, els.glassOutput, 'glass', '%');
    bindRange(els.radiusRange, els.radiusOutput, 'radius', 'px');

    els.accentOptions.addEventListener('click', event => {
      const button = event.target.closest('[data-accent]');
      if (!button) return;
      setAccent(button.dataset.accent);
    });
    els.accentColorInput.addEventListener('input', () => setAccent(els.accentColorInput.value));

    els.animationsToggle.addEventListener('change', () => {
      data.settings.animations = els.animationsToggle.checked;
      applySettings();
      saveData();
    });
    els.wallpaperMotionToggle.addEventListener('change', () => {
      data.settings.wallpaperMotion = els.wallpaperMotionToggle.checked;
      applySettings();
      saveData();
    });
    els.showDescriptionsToggle.addEventListener('change', () => {
      data.settings.showDescriptions = els.showDescriptionsToggle.checked;
      applySettings();
      saveData();
    });
    els.showTagsToggle.addEventListener('change', () => {
      data.settings.showTags = els.showTagsToggle.checked;
      applySettings();
      saveData();
    });
    els.sidebarToggle.addEventListener('change', () => {
      data.settings.sidebarCollapsed = els.sidebarToggle.checked;
      applySettings();
      saveData();
    });
    $$('.segment[data-density]').forEach(button => button.addEventListener('click', () => {
      data.settings.density = button.dataset.density;
      applySettings();
      saveData();
      renderAll();
    }));

    $$('.view-btn').forEach(button => button.addEventListener('click', () => {
      data.settings.layout = button.dataset.layout;
      applySettings();
      saveData();
      renderAll();
    }));
    els.sortSelect.addEventListener('change', () => {
      data.settings.sort = els.sortSelect.value;
      saveData();
      renderLibrary();
      renderViewControls();
    });

    $('#exportData').addEventListener('click', exportData);
    $('#importData').addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', () => importDataFromFile(els.importFile.files[0]));
    $('#resetData').addEventListener('click', resetAllData);

    $('#syncConnectBtn').addEventListener('click', connectSync);
    $('#syncPull').addEventListener('click', () => pullSync(true));
    $('#syncPush').addEventListener('click', () => pushSync(true));
    $('#syncDisconnect').addEventListener('click', disconnectSync);
    els.autoSyncToggle.addEventListener('change', () => {
      if (!sync) return;
      sync.auto = els.autoSyncToggle.checked;
      saveSyncState();
      toast(sync.auto ? '已开启自动上传' : '已关闭自动上传');
    });
    els.syncTokenToggle.addEventListener('click', () => {
      const show = els.syncToken.type === 'password';
      els.syncToken.type = show ? 'text' : 'password';
      els.syncTokenToggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
      els.syncTokenToggle.setAttribute('aria-label', show ? '隐藏令牌' : '显示令牌');
    });
    els.syncToken.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); connectSync(); }
    });

    els.siteForm.addEventListener('submit', submitSiteForm);
    $('#deleteSiteBtn').addEventListener('click', deleteEditingSite);
    els.categoryForm.addEventListener('submit', submitCategoryForm);
    els.categoryColorSwatches.addEventListener('click', event => {
      const button = event.target.closest('[data-color]');
      if (button) setCategoryColor(button.dataset.color);
    });
    els.categoryManagerList.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-category]');
      if (button) deleteCategory(button.dataset.deleteCategory);
    });
    els.siteTitle.addEventListener('input', () => els.siteTitle.classList.remove('is-invalid'));
    els.siteUrl.addEventListener('input', () => els.siteUrl.classList.remove('is-invalid'));
    els.categoryName.addEventListener('input', () => els.categoryName.classList.remove('is-invalid'));

    els.confirmOk.addEventListener('click', () => {
      resolveConfirm(true);
      closeLayer(els.confirmModal, { restoreFocus: false });
    });
    els.confirmCancel.addEventListener('click', () => {
      resolveConfirm(false);
      closeLayer(els.confirmModal, { restoreFocus: false });
    });

    els.paletteInput.addEventListener('input', () => {
      paletteIndex = 0;
      renderPalette();
    });
    els.paletteInput.addEventListener('keydown', handlePaletteKeydown);
    els.paletteResults.addEventListener('click', event => {
      const button = event.target.closest('[data-palette-index]');
      if (!button) return;
      executePaletteItem(Number(button.dataset.paletteIndex));
    });
    $$('.palette-backdrop').forEach(node => node.addEventListener('click', closePalette));

    document.addEventListener('click', event => {
      const closeTarget = event.target.closest('[data-close]');
      if (closeTarget) {
        const id = closeTarget.dataset.close;
        if (id === 'confirmModal') resolveConfirm(false);
        closeModal(id);
        return;
      }
      const drawerTarget = event.target.closest('[data-close-drawer]');
      if (drawerTarget) {
        closeLayer(document.getElementById(drawerTarget.dataset.closeDrawer));
      }
    });

    document.addEventListener('keydown', event => {
      const target = event.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (els.paletteLayer.classList.contains('is-open')) closePalette();
        else openPalette();
        return;
      }
      if (command && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (event.key === 'Escape') {
        closeAnyLayer();
        return;
      }
      if (!typing && !command && !event.altKey && event.key === '/') {
        event.preventDefault();
        els.searchInput.focus();
        return;
      }
      if (!typing && !command && !event.altKey && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        openSiteForm();
      }
    });

    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const incoming = normalizeData(JSON.parse(event.newValue));
          if (incoming.meta.updatedAt > data.meta.updatedAt) {
            data = incoming;
            applySettings();
            renderAll();
          }
        } catch { /* ignore invalid */ }
      }
      if (event.key === SYNC_KEY) {
        sync = loadSyncState();
        renderSyncUI();
        renderSyncPill();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 920 && document.body.classList.contains('mobile-sidebar-open')) {
        closeMobileSidebar();
      }
    });

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const handler = () => { if (data.settings.theme === 'system') applySettings(); };
      if (media.addEventListener) media.addEventListener('change', handler);
      else if (media.addListener) media.addListener(handler);
    }
  }

  function renderShortSearchState() {
    renderLibrary();
    renderViewControls();
    updatePageHeading(filteredSites());
  }

  function trackVisit(site) {
    site.lastVisited = Date.now();
    site.visits = (site.visits || 0) + 1;
    saveData();
    if (currentView === 'recent' || data.settings.sort === 'recent' || data.settings.sort === 'visits') {
      setTimeout(renderLibrary, 80);
    }
  }

  function buildCategoryColorSwatches() {
    els.categoryColorSwatches.innerHTML = CATEGORY_COLORS.map(color =>
      `<button type="button" class="color-swatch" data-color="${color}" style="--swatch:${color}" aria-label="颜色 ${color}"></button>`
    ).join('');
  }

  function init() {
    buildCategoryColorSwatches();
    if (!localStorage.getItem(STORAGE_KEY)) saveData({ sync: false });
    applySettings();
    updateClock();
    setInterval(updateClock, 30000);
    renderAll();
    bindEvents();
    setSyncBusy(false);
    renderSyncUI();
    renderSyncPill();
    els.wallpaperUrl.value = '';
    document.body.classList.add('is-ready');
  }

  init();
})();
