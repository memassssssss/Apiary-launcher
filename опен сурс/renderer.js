const { ipcRenderer } = require('electron');

let state = {
  accounts: [],
  selectedAccountId: '',
  instances: [],
  selectedInstanceId: '',
  versions: [],
  ram: 4,
  maxRam: 16,
  javaType: 'auto',
  javaCustomPath: '',
  theme: null,
  customPresets: []
};

// Элементы боковой панели
const uiSidebar = document.getElementById('uiSidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const quoteDisplay = document.getElementById('quoteDisplay');
const artSection = document.querySelector('.art-section');

// Профиль
const accountTypeSelect = document.getElementById('accountTypeSelect');
const accountSelect = document.getElementById('accountSelect');
const offlineAddRow = document.getElementById('offlineAddRow');
const msAuthRow = document.getElementById('msAuthRow');
const newNickInput = document.getElementById('newNickInput');
const addNickBtn = document.getElementById('addNickBtn');
const msLoginBtn = document.getElementById('msLoginBtn');
const removeNickBtn = document.getElementById('removeNickBtn');

// Сборки
const instancesGrid = document.getElementById('instancesGrid');
const toggleAddInstanceBtn = document.getElementById('toggleAddInstanceBtn');
const addInstanceBlock = document.getElementById('addInstanceBlock');
const newInstanceName = document.getElementById('newInstanceName');
const versionSelect = document.getElementById('versionSelect');
const loaderSelect = document.getElementById('loaderSelect');
const createInstanceBtn = document.getElementById('createInstanceBtn');
const cancelInstanceBtn = document.getElementById('cancelInstanceBtn');

// Настройки
const ramRange = document.getElementById('ramRange');
const ramValue = document.getElementById('ramValue');
const javaTypeSelect = document.getElementById('javaTypeSelect');
const javaCustomGroup = document.getElementById('javaCustomGroup');
const javaCustomPathInput = document.getElementById('javaCustomPathInput');
const browseJavaBtn = document.getElementById('browseJavaBtn');

// Консоль и запуск
const consoleBox = document.getElementById('consoleBox');
const clearConsoleBtn = document.getElementById('clearConsoleBtn');
const statusBox = document.getElementById('statusBox');
const progressFill = document.getElementById('progressFill');
const playBtn = document.getElementById('playBtn');

// Каталог контента
const modManagerModal = document.getElementById('modManagerModal');
const openModManagerBtn = document.getElementById('openModManagerBtn');
const closeModManagerBtn = document.getElementById('closeModManagerBtn');
const tabSearchMods = document.getElementById('tabSearchMods');
const tabInstalledMods = document.getElementById('tabInstalledMods');
const modSearchTabContent = document.getElementById('modSearchTabContent');
const modInstalledTabContent = document.getElementById('modInstalledTabContent');
const modSearchInput = document.getElementById('modSearchInput');
const modSearchBtn = document.getElementById('modSearchBtn');
const modSearchResults = document.getElementById('modSearchResults');
const installedModsList = document.getElementById('installedModsList');
const modManagerInstanceName = document.getElementById('modManagerInstanceName');
const modManagerInstanceDetails = document.getElementById('modManagerInstanceDetails');
const contentSourceWrapper = document.getElementById('contentSourceWrapper');

// Скриншоты
const screenshotsModal = document.getElementById('screenshotsModal');
const openScreenshotsBtn = document.getElementById('openScreenshotsBtn');
const closeScreenshotsBtn = document.getElementById('closeScreenshotsBtn');
const screenshotsGrid = document.getElementById('screenshotsGrid');
const screenshotsInstanceName = document.getElementById('screenshotsInstanceName');

// Редактор темы
const themeEditorModal = document.getElementById('themeEditorModal');
const openThemeEditorBtn = document.getElementById('openThemeEditorBtn');
const closeThemeEditorBtn = document.getElementById('closeThemeEditorBtn');
const cancelThemeBtn = document.getElementById('cancelThemeBtn');
const saveThemeBtn = document.getElementById('saveThemeBtn');
const resetThemeBtn = document.getElementById('resetThemeBtn');
const browseBgBtn = document.getElementById('browseBgBtn');
const bgImageUrlInput = document.getElementById('bgImageUrlInput');
const quoteTextInput = document.getElementById('quoteTextInput');
const presetSelect = document.getElementById('presetSelect');
const applyPresetBtn = document.getElementById('applyPresetBtn');
const deletePresetBtn = document.getElementById('deletePresetBtn');
const newPresetNameInput = document.getElementById('newPresetNameInput');
const savePresetBtn = document.getElementById('savePresetBtn');

// Переменные выбранного контента
let currentContentType = 'mod';
let currentContentSource = 'modrinth';
let activeContentTab = 'search';

if (toggleSidebarBtn && uiSidebar) {
  toggleSidebarBtn.addEventListener('click', () => {
    const isCollapsed = uiSidebar.classList.toggle('collapsed');
    toggleSidebarBtn.classList.toggle('is-collapsed', isCollapsed);
    toggleSidebarBtn.textContent = isCollapsed ? '◄' : '►';
  });
}

function escapeHtml(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function log(type, message) {
  if (!consoleBox) return;
  const line = document.createElement('div');
  line.className = `log-${type || 'info'}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleBox.appendChild(line);
  if (consoleBox.children.length > 800) consoleBox.removeChild(consoleBox.firstChild);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function normalizeAccounts(rawAccounts) {
  if (!Array.isArray(rawAccounts)) return [{ id: 'offline_Player', name: 'Player', type: 'offline' }];
  return rawAccounts.map(acc => typeof acc === 'string' ? { id: `offline_${acc}`, name: acc, type: 'offline' } : acc);
}

function saveState() {
  ipcRenderer.send('save-data', {
    accounts: state.accounts,
    selectedAccountId: state.selectedAccountId,
    instances: state.instances,
    selectedInstanceId: state.selectedInstanceId,
    ram: state.ram,
    javaType: state.javaType,
    javaCustomPath: state.javaCustomPath,
    theme: state.theme,
    customPresets: state.customPresets
  });
}

// ==========================================
// ТЕМЫ И ПРЕСЕТЫ
// ==========================================
const DEFAULT_THEME = {
  bgImage: './bac.gif',
  quoteText: 'Возвращайся домой, пчёлка.',
  sagePrimary: '#86d4a8',
  sageHover: '#a3e6c0',
  sageDark: '#37634d',
  bgDark: '#121c17',
  bgPanel: '#1b2922',
  bgCard: '#22362c',
  bgInput: '#101a15',
  borderDark: '#090f0d',
  borderSoft: '#304a3d',
  textMain: '#f0fdf5',
  textDim: '#94c4a9',
  danger: '#e27d8b',
  artOverlay: '#121c17'
};

const BUILTIN_PRESETS = [
  {
    id: 'default_sage',
    name: 'Sage (Зеленый)',
    theme: { ...DEFAULT_THEME }
  },
  {
    id: 'preset_sakura',
    name: 'Sakura (Розовый)',
    theme: {
      bgImage: './bac.gif',
      quoteText: 'Возвращайся домой, пчёлка.',
      sagePrimary: '#f3a6c8',
      sageHover: '#f8c2dc',
      sageDark: '#a84e77',
      bgDark: '#231219',
      bgPanel: '#301a24',
      bgCard: '#3d2230',
      bgInput: '#1a0c12',
      borderDark: '#10060b',
      borderSoft: '#542c40',
      textMain: '#fff0f6',
      textDim: '#d9a3be',
      danger: '#e25c75',
      artOverlay: '#231219'
    }
  },
  {
    id: 'preset_honey',
    name: 'Honey (Медовый)',
    theme: {
      bgImage: './bac.gif',
      quoteText: 'Возвращайся домой, пчёлка.',
      sagePrimary: '#f2ca6b',
      sageHover: '#f7d992',
      sageDark: '#9c7728',
      bgDark: '#211a0e',
      bgPanel: '#2c2314',
      bgCard: '#382d1a',
      bgInput: '#171208',
      borderDark: '#0e0b04',
      borderSoft: '#4f3f22',
      textMain: '#fffdf0',
      textDim: '#cca362',
      danger: '#e2665c',
      artOverlay: '#211a0e'
    }
  }
];

const THEME_CSS_MAP = {
  sagePrimary: '--sage-primary',
  sageHover: '--sage-hover',
  sageDark: '--sage-dark',
  bgDark: '--bg-dark',
  bgPanel: '--bg-panel',
  bgCard: '--bg-card',
  bgInput: '--bg-input',
  borderDark: '--border-dark',
  borderSoft: '--border-soft',
  textMain: '--text-main',
  textDim: '--text-dim',
  danger: '--danger',
  artOverlay: '--art-overlay'
};

function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  state.theme = t;

  if (t.bgImage && artSection) {
    const cleanPath = t.bgImage.replace(/\\/g, '/');
    artSection.style.backgroundImage = `url("${cleanPath}")`;
  }

  if (quoteDisplay) {
    const qText = t.quoteText !== undefined ? t.quoteText : DEFAULT_THEME.quoteText;
    quoteDisplay.textContent = qText;
    quoteDisplay.style.display = qText.trim() === '' ? 'none' : 'block';
  }

  Object.entries(THEME_CSS_MAP).forEach(([key, cssVar]) => {
    if (t[key]) document.documentElement.style.setProperty(cssVar, t[key]);
  });
}

function loadThemeToInputs(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  if (bgImageUrlInput) bgImageUrlInput.value = t.bgImage;
  if (quoteTextInput) quoteTextInput.value = t.quoteText !== undefined ? t.quoteText : DEFAULT_THEME.quoteText;

  Object.keys(THEME_CSS_MAP).forEach(key => {
    const colorEl = document.getElementById(`color_${key}`);
    const textEl = document.getElementById(`text_${key}`);
    if (colorEl && textEl) {
      colorEl.value = t[key] || DEFAULT_THEME[key];
      textEl.value = t[key] || DEFAULT_THEME[key];
    }
  });
}

function setupColorInputsSync() {
  Object.keys(THEME_CSS_MAP).forEach(key => {
    const colorEl = document.getElementById(`color_${key}`);
    const textEl = document.getElementById(`text_${key}`);
    if (colorEl && textEl) {
      colorEl.addEventListener('input', () => { textEl.value = colorEl.value; });
      textEl.addEventListener('input', () => {
        if (/^#[0-9A-F]{6}$/i.test(textEl.value)) colorEl.value = textEl.value;
      });
    }
  });
}
setupColorInputsSync();

function renderPresetSelect() {
  if (!presetSelect) return;
  presetSelect.innerHTML = '';

  const optGroupBuiltin = document.createElement('optgroup');
  optGroupBuiltin.label = 'Встроенные пресеты';

  BUILTIN_PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    optGroupBuiltin.appendChild(opt);
  });
  presetSelect.appendChild(optGroupBuiltin);

  if (state.customPresets && state.customPresets.length > 0) {
    const optGroupCustom = document.createElement('optgroup');
    optGroupCustom.label = 'Пользовательские пресеты';
    state.customPresets.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      optGroupCustom.appendChild(opt);
    });
    presetSelect.appendChild(optGroupCustom);
  }

  updatePresetButtons();
}

function updatePresetButtons() {
  if (!presetSelect || !deletePresetBtn) return;
  const selectedId = presetSelect.value;
  const isCustom = state.customPresets && state.customPresets.some(p => p.id === selectedId);
  deletePresetBtn.style.display = isCustom ? 'inline-block' : 'none';
}

if (presetSelect) presetSelect.addEventListener('change', updatePresetButtons);

if (applyPresetBtn) {
  applyPresetBtn.addEventListener('click', () => {
    const selectedId = presetSelect.value;
    let targetPreset = BUILTIN_PRESETS.find(p => p.id === selectedId);
    if (!targetPreset && state.customPresets) {
      targetPreset = state.customPresets.find(p => p.id === selectedId);
    }

    if (targetPreset && targetPreset.theme) {
      loadThemeToInputs(targetPreset.theme);
      applyTheme(targetPreset.theme);
      saveState();
      log('info', `Применен пресет: "${targetPreset.name}"`);
    }
  });
}

if (savePresetBtn) {
  savePresetBtn.addEventListener('click', () => {
    const name = newPresetNameInput ? newPresetNameInput.value.trim() : '';
    if (!name) {
      alert('Введите название для нового пресета!');
      return;
    }

    const currentThemeFromInputs = {
      bgImage: bgImageUrlInput ? bgImageUrlInput.value.trim() : DEFAULT_THEME.bgImage,
      quoteText: quoteTextInput ? quoteTextInput.value : DEFAULT_THEME.quoteText
    };

    Object.keys(THEME_CSS_MAP).forEach(key => {
      const textEl = document.getElementById(`text_${key}`);
      currentThemeFromInputs[key] = textEl ? textEl.value : DEFAULT_THEME[key];
    });

    const newPreset = {
      id: `custom_${Date.now()}`,
      name: name,
      theme: currentThemeFromInputs
    };

    if (!Array.isArray(state.customPresets)) state.customPresets = [];
    state.customPresets.push(newPreset);
    if (newPresetNameInput) newPresetNameInput.value = '';

    renderPresetSelect();
    presetSelect.value = newPreset.id;
    updatePresetButtons();

    applyTheme(currentThemeFromInputs);
    saveState();
    log('info', `Сохранен пресет: "${name}"`);
  });
}

if (deletePresetBtn) {
  deletePresetBtn.addEventListener('click', () => {
    const selectedId = presetSelect.value;
    const preset = state.customPresets && state.customPresets.find(p => p.id === selectedId);
    if (!preset) return;

    if (confirm(`Удалить пресет "${preset.name}"?`)) {
      state.customPresets = state.customPresets.filter(p => p.id !== selectedId);
      renderPresetSelect();
      saveState();
      log('info', `Удален пресет: "${preset.name}"`);
    }
  });
}

if (openThemeEditorBtn) {
  openThemeEditorBtn.addEventListener('click', () => {
    loadThemeToInputs(state.theme);
    renderPresetSelect();
    if (themeEditorModal) themeEditorModal.style.display = 'flex';
  });
}
const closeThemeModal = () => { if (themeEditorModal) themeEditorModal.style.display = 'none'; };
if (closeThemeEditorBtn) closeThemeEditorBtn.addEventListener('click', closeThemeModal);
if (cancelThemeBtn) cancelThemeBtn.addEventListener('click', closeThemeModal);

if (browseBgBtn) {
  browseBgBtn.addEventListener('click', async () => {
    const p = await ipcRenderer.invoke('select-bg-file');
    if (p && bgImageUrlInput) bgImageUrlInput.value = p;
  });
}

if (saveThemeBtn) {
  saveThemeBtn.addEventListener('click', () => {
    const newTheme = {
      bgImage: bgImageUrlInput ? bgImageUrlInput.value.trim() : DEFAULT_THEME.bgImage,
      quoteText: quoteTextInput ? quoteTextInput.value : DEFAULT_THEME.quoteText
    };
    Object.keys(THEME_CSS_MAP).forEach(key => {
      const textEl = document.getElementById(`text_${key}`);
      newTheme[key] = textEl ? textEl.value : DEFAULT_THEME[key];
    });
    applyTheme(newTheme);
    saveState();
    closeThemeModal();
  });
}

if (resetThemeBtn) {
  resetThemeBtn.addEventListener('click', () => {
    loadThemeToInputs(DEFAULT_THEME);
  });
}

// ==========================================
// УПРАВЛЕНИЕ СЕГМЕНТИРОВАННЫМИ ЧИПАМИ КАТАЛОГА
// ==========================================
const contentTypeButtons = document.querySelectorAll('#contentTypeGroup .segmented-btn');
contentTypeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    contentTypeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentContentType = btn.dataset.type;
    if (activeContentTab === 'search') performContentSearch();
    else loadInstalledContent();
  });
});

const contentSourceButtons = document.querySelectorAll('#contentSourceWrapper .segmented-btn');
contentSourceButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    contentSourceButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentContentSource = btn.dataset.source;
    if (activeContentTab === 'search') performContentSearch();
  });
});

function switchContentTab(tab) {
  activeContentTab = tab;
  if (tab === 'search') {
    tabSearchMods.classList.add('active');
    tabInstalledMods.classList.remove('active');
    modSearchTabContent.style.display = 'flex';
    modInstalledTabContent.style.display = 'none';
    if (contentSourceWrapper) contentSourceWrapper.style.display = 'inline-flex';
  } else {
    tabInstalledMods.classList.add('active');
    tabSearchMods.classList.remove('active');
    modSearchTabContent.style.display = 'none';
    modInstalledTabContent.style.display = 'flex';
    if (contentSourceWrapper) contentSourceWrapper.style.display = 'none';
    loadInstalledContent();
  }
}

if (tabSearchMods && tabInstalledMods) {
  tabSearchMods.addEventListener('click', () => switchContentTab('search'));
  tabInstalledMods.addEventListener('click', () => switchContentTab('installed'));
}

if (openModManagerBtn) {
  openModManagerBtn.addEventListener('click', () => {
    const currentInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
    if (!currentInst) return;

    if (modManagerInstanceName) modManagerInstanceName.textContent = currentInst.name;
    if (modManagerInstanceDetails) modManagerInstanceDetails.textContent = `${currentInst.version} (${currentInst.loader.toUpperCase()})`;
    if (modManagerModal) modManagerModal.style.display = 'flex';
    switchContentTab('search');
    performContentSearch();
  });
}

const closeContentModal = () => { if (modManagerModal) modManagerModal.style.display = 'none'; };
if (closeModManagerBtn) closeModManagerBtn.addEventListener('click', closeContentModal);

if (modSearchBtn) modSearchBtn.addEventListener('click', performContentSearch);
if (modSearchInput) {
  modSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performContentSearch(); });
}

async function performContentSearch() {
  const currentInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
  if (!currentInst || !modSearchResults) return;

  const query = modSearchInput ? modSearchInput.value.trim() : '';
  modSearchResults.innerHTML = `<div style="text-align:center; color:var(--sage-primary); padding:24px;">Поиск в ${currentContentSource.toUpperCase()}...</div>`;

  try {
    const res = await ipcRenderer.invoke('search-content', {
      query,
      version: currentInst.version,
      loader: currentInst.loader,
      type: currentContentType,
      source: currentContentSource
    });

    if (!res || !res.success) {
      modSearchResults.innerHTML = `<div style="text-align:center; color:var(--danger); padding:24px;">Ошибка поиска: ${escapeHtml(res ? res.error : 'Сервер не отвечает')}</div>`;
      return;
    }

    if (!res.items || res.items.length === 0) {
      modSearchResults.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:24px;">Ничего не найдено. Попробуйте изменить запрос.</div>`;
      return;
    }

    renderContentSearchResults(res.items, currentInst);
  } catch (err) {
    modSearchResults.innerHTML = `<div style="text-align:center; color:var(--danger); padding:24px;">Сбой: ${escapeHtml(err.message)}</div>`;
  }
}
function renderContentSearchResults(items, currentInst) {
  if (!modSearchResults) return;
  modSearchResults.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'mod-card';

    let defaultIcon = '🧩';
    if (currentContentType === 'shader') defaultIcon = '✨';
    else if (currentContentType === 'resourcepack') defaultIcon = '🎨';

    const iconHtml = item.iconUrl 
      ? `<img class="mod-icon" src="${item.iconUrl}" alt="icon">` 
      : `<div class="mod-icon">${defaultIcon}</div>`;

    const downloads = item.downloads ? item.downloads.toLocaleString() : '0';

    card.innerHTML = `
      ${iconHtml}
      <div class="mod-details">
        <div class="mod-title-row">
          <span class="mod-name">${escapeHtml(item.title)}</span>
          <span class="mod-author">by ${escapeHtml(item.author)}</span>
        </div>
        <div class="mod-description">${escapeHtml(item.description || 'Без описания')}</div>
        <div class="mod-stats">
          <span>⬇ ${downloads}</span>
          <span style="color:var(--text-dim); text-transform:uppercase;">[${escapeHtml(item.source)}]</span>
        </div>
      </div>
      <button class="btn-install" data-id="${item.id}">Установить</button>
    `;

    const installBtn = card.querySelector('.btn-install');
    installBtn.addEventListener('click', async () => {
      installBtn.disabled = true;
      installBtn.textContent = 'Скачка...';

      const res = await ipcRenderer.invoke('install-content-item', {
        id: item.id,
        source: item.source,
        type: currentContentType,
        instanceId: currentInst.id,
        mcVersion: currentInst.version,
        loader: currentInst.loader
      });

      if (res.success) {
        installBtn.textContent = '✓ Готово';
        installBtn.style.background = 'var(--border-soft)';
        installBtn.style.color = 'var(--sage-primary)';
      } else {
        alert(`Ошибка установки: ${res.error}`);
        installBtn.disabled = false;
        installBtn.textContent = 'Установить';
      }
    });

    modSearchResults.appendChild(card);
  });
}

async function loadInstalledContent() {
  const currentInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
  if (!currentInst || !installedModsList) return;

  let folderDesc = 'папке mods';
  if (currentContentType === 'shader') folderDesc = 'папке shaderpacks';
  else if (currentContentType === 'resourcepack') folderDesc = 'папке resourcepacks';

  installedModsList.innerHTML = `<div style="text-align:center; color:var(--sage-primary); padding:24px;">Загрузка списка...</div>`;

  const files = await ipcRenderer.invoke('get-installed-content', { instanceId: currentInst.id, type: currentContentType });

  if (!files || files.length === 0) {
    installedModsList.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:24px;">Ничего не установлено в ${folderDesc}.</div>`;
    return;
  }

  let defaultIcon = '🧩';
  if (currentContentType === 'shader') defaultIcon = '✨';
  else if (currentContentType === 'resourcepack') defaultIcon = '🎨';

  installedModsList.innerHTML = '';
  files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    card.innerHTML = `
      <div class="mod-icon">${defaultIcon}</div>
      <div class="mod-details">
        <span class="mod-name" style="font-size: 9px;">${escapeHtml(file)}</span>
      </div>
      <button class="btn-action btn-danger delete-mod-btn">Удалить</button>
    `;

    card.querySelector('.delete-mod-btn').addEventListener('click', async () => {
      if (confirm(`Удалить файл ${file}?`)) {
        await ipcRenderer.invoke('delete-content-file', { instanceId: currentInst.id, type: currentContentType, filename: file });
        loadInstalledContent();
      }
    });

    installedModsList.appendChild(card);
  });
}

// ==========================================
// ГАЛЕРЕЯ СКРИНШОТОВ
// ==========================================
if (openScreenshotsBtn) {
  openScreenshotsBtn.addEventListener('click', async () => {
    const currentInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
    if (!currentInst) return;
    if (screenshotsInstanceName) screenshotsInstanceName.textContent = currentInst.name;
    if (screenshotsModal) screenshotsModal.style.display = 'flex';
    await loadScreenshotsGallery(currentInst.id);
  });
}

const closeScreenshotsModal = () => { if (screenshotsModal) screenshotsModal.style.display = 'none'; };
if (closeScreenshotsBtn) closeScreenshotsBtn.addEventListener('click', closeScreenshotsModal);

async function loadScreenshotsGallery(instanceId) {
  if (!screenshotsGrid) return;
  screenshotsGrid.innerHTML = `<div style="text-align:center; color:var(--sage-primary); padding:30px;">Загрузка скриншотов...</div>`;

  const items = await ipcRenderer.invoke('get-screenshots', instanceId);
  if (!items || items.length === 0) {
    screenshotsGrid.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:40px; grid-column:1/-1;">В этой сборке пока нет скриншотов (нажмите F2 в игре).</div>`;
    return;
  }

  screenshotsGrid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'screenshot-card';
    const dateStr = new Date(item.mtime).toLocaleString();

    card.innerHTML = `
      <img class="screenshot-img" src="${item.url}" alt="${escapeHtml(item.name)}">
      <div class="screenshot-info">
        <span class="screenshot-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <span class="screenshot-date">${dateStr}</span>
      </div>
      <div class="screenshot-actions">
        <button class="btn-action copy-btn" title="Скопировать в буфер обмена (для Discord/VK/TG)">📋 Копировать</button>
        <button class="btn-action set-bg-btn" title="Сделать задним фоном лаунчера">🖼️ Фоном</button>
        <button class="btn-action show-folder-btn" title="Показать в проводнике">📂</button>
        <button class="btn-action btn-danger delete-btn" title="Удалить">🗑️</button>
      </div>
    `;

    card.querySelector('.copy-btn').addEventListener('click', async (e) => {
      const btn = e.target;
      const ok = await ipcRenderer.invoke('copy-screenshot-to-clipboard', item.path);
      if (ok) {
        btn.textContent = '✓ В буфере!';
        setTimeout(() => btn.textContent = '📋 Копировать', 1500);
      }
    });

    card.querySelector('.set-bg-btn').addEventListener('click', () => {
      state.theme = { ...DEFAULT_THEME, ...state.theme, bgImage: item.path };
      applyTheme(state.theme);
      saveState();
      log('info', `Скриншот "${item.name}" установлен задним фоном лаунчера!`);
    });

    card.querySelector('.show-folder-btn').addEventListener('click', () => {
      ipcRenderer.invoke('show-item-in-folder', item.path);
    });

    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Удалить скриншот ${item.name}?`)) {
        await ipcRenderer.invoke('delete-screenshot', item.path);
        loadScreenshotsGallery(instanceId);
      }
    });

    screenshotsGrid.appendChild(card);
  });
}

// ==========================================
// АККАУНТЫ
// ==========================================
function updateAccountTypeUI() {
  if (!accountTypeSelect) return;
  const isMs = accountTypeSelect.value === 'microsoft';
  if (offlineAddRow) offlineAddRow.style.display = isMs ? 'none' : 'flex';
  if (msAuthRow) msAuthRow.style.display = isMs ? 'flex' : 'none';
  renderAccounts();
}

function renderAccounts() {
  if (!accountSelect || !accountTypeSelect) return;
  accountSelect.innerHTML = '';
  const selectedType = accountTypeSelect.value;
  const filtered = state.accounts.filter(acc => (acc.type || 'offline') === selectedType);

  if (filtered.length === 0) {
    accountSelect.innerHTML = `<option value="">-- Нет профилей --</option>`;
    accountSelect.disabled = true;
    state.selectedAccountId = '';
    return;
  }

  accountSelect.disabled = false;
  filtered.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.name;
    accountSelect.appendChild(opt);
  });

  if (filtered.some(a => a.id === state.selectedAccountId)) {
    accountSelect.value = state.selectedAccountId;
  } else {
    state.selectedAccountId = filtered[0].id;
    accountSelect.value = state.selectedAccountId;
    saveState();
  }
}

if (accountTypeSelect) accountTypeSelect.addEventListener('change', updateAccountTypeUI);

if (addNickBtn) {
  addNickBtn.addEventListener('click', () => {
    const nick = newNickInput ? newNickInput.value.trim() : '';
    if (!nick) return;
    const id = `offline_${nick}`;
    if (!state.accounts.some(a => a.id === id)) state.accounts.push({ id, name: nick, type: 'offline' });
    state.selectedAccountId = id;
    if (newNickInput) newNickInput.value = '';
    renderAccounts();
    saveState();
    log('info', `Добавлен никнейм: ${nick}`);
  });
}

if (msLoginBtn) {
  msLoginBtn.addEventListener('click', async () => {
    msLoginBtn.disabled = true;
    msLoginBtn.textContent = 'Вход...';
    const res = await ipcRenderer.invoke('ms-login');
    msLoginBtn.disabled = false;
    msLoginBtn.textContent = 'Войти через Microsoft';
    if (res.success) {
      const idx = state.accounts.findIndex(a => a.id === res.account.id);
      if (idx >= 0) state.accounts[idx] = res.account;
      else state.accounts.push(res.account);
      state.selectedAccountId = res.account.id;
      renderAccounts();
      saveState();
      log('info', `Вход выполнен: ${res.account.name}`);
    } else {
      log('error', `Ошибка входа: ${res.error}`);
    }
  });
}

if (accountSelect) {
  accountSelect.addEventListener('change', () => {
    state.selectedAccountId = accountSelect.value;
    saveState();
  });
}

if (removeNickBtn) {
  removeNickBtn.addEventListener('click', () => {
    if (state.accounts.length <= 1) {
      log('error', 'Нельзя удалить единственный профиль!');
      return;
    }
    state.accounts = state.accounts.filter(a => a.id !== state.selectedAccountId);
    if (state.accounts.length > 0) {
      state.selectedAccountId = state.accounts[0].id;
      if (accountTypeSelect) accountTypeSelect.value = state.accounts[0].type || 'offline';
      updateAccountTypeUI();
    }
    renderAccounts();
    saveState();
  });
}

// ==========================================
// СБОРКИ
// ==========================================
function renderInstances() {
  if (!instancesGrid) return;
  instancesGrid.innerHTML = '';
  state.instances.forEach(inst => {
    const card = document.createElement('div');
    card.className = `instance-card ${inst.id === state.selectedInstanceId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="instance-header-row">
        <div class="instance-pixel-icon">📦</div>
        <div class="instance-title">${escapeHtml(inst.name)}</div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
        <span class="badge-loader">${escapeHtml(inst.loader)}</span>
        <span style="font-size:9px; color:var(--text-dim);">${escapeHtml(inst.version)}</span>
      </div>
      <div style="display:flex; gap:4px; margin-top:6px;">
        <button class="btn-action open-folder-btn" style="flex:1; font-size:7px; padding:4px;">Папка</button>
        <button class="btn-action btn-danger delete-inst-btn" style="font-size:7px; padding:4px;">X</button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.open-folder-btn') || e.target.closest('.delete-inst-btn')) return;
      state.selectedInstanceId = inst.id;
      renderInstances();
      saveState();
    });

    card.querySelector('.open-folder-btn').addEventListener('click', () => ipcRenderer.invoke('open-instance-folder', inst.id));
    card.querySelector('.delete-inst-btn').addEventListener('click', async () => {
      if (state.instances.length <= 1) return;
      await ipcRenderer.invoke('delete-instance', inst.id);
      state.instances = state.instances.filter(i => i.id !== inst.id);
      if (state.selectedInstanceId === inst.id) state.selectedInstanceId = state.instances[0].id;
      renderInstances();
      saveState();
    });

    instancesGrid.appendChild(card);
  });
}

if (toggleAddInstanceBtn) toggleAddInstanceBtn.addEventListener('click', () => {
  if (addInstanceBlock) addInstanceBlock.style.display = addInstanceBlock.style.display === 'none' ? 'flex' : 'none';
});
if (cancelInstanceBtn) cancelInstanceBtn.addEventListener('click', () => {
  if (addInstanceBlock) addInstanceBlock.style.display = 'none';
});

if (createInstanceBtn) {
  createInstanceBtn.addEventListener('click', () => {
    const name = newInstanceName ? newInstanceName.value.trim() : '';
    if (!name) return;
    const newInst = {
      id: name,
      name: name,
      version: versionSelect ? versionSelect.value : '1.20.1',
      loader: loaderSelect ? loaderSelect.value : 'vanilla'
    };
    state.instances.push(newInst);
    state.selectedInstanceId = newInst.id;
    if (newInstanceName) newInstanceName.value = '';
    if (addInstanceBlock) addInstanceBlock.style.display = 'none';
    renderInstances();
    saveState();
    log('info', `Создана сборка "${name}" [${newInst.loader.toUpperCase()} ${newInst.version}]`);
  });
}

// ==========================================
// НАСТРОЙКИ (RAM, JAVA, ИГРАТЬ)
// ==========================================
if (ramRange) {
  ramRange.addEventListener('input', () => {
    state.ram = parseFloat(ramRange.value);
    if (ramValue) ramValue.textContent = `${state.ram.toFixed(1)} ГБ`;
    saveState();
  });
}

if (javaTypeSelect) {
  javaTypeSelect.addEventListener('change', () => {
    state.javaType = javaTypeSelect.value;
    if (javaCustomGroup) javaCustomGroup.style.display = state.javaType === 'custom' ? 'block' : 'none';
    saveState();
  });
}

if (browseJavaBtn) {
  browseJavaBtn.addEventListener('click', async () => {
    const p = await ipcRenderer.invoke('select-java-file');
    if (p) {
      if (javaCustomPathInput) javaCustomPathInput.value = p;
      state.javaCustomPath = p;
      saveState();
    }
  });
}

if (clearConsoleBtn) clearConsoleBtn.addEventListener('click', () => { if (consoleBox) consoleBox.innerHTML = ''; });

if (playBtn) {
  playBtn.addEventListener('click', () => {
    const selectedAcc = state.accounts.find(a => a.id === state.selectedAccountId);
    const selectedInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
    if (!selectedAcc || !selectedInst) return;

    playBtn.disabled = true;
    playBtn.textContent = 'ЗАПУСК...';
    if (statusBox) statusBox.textContent = 'Инициализация запуска...';
    if (progressFill) progressFill.style.width = '0%';

    ipcRenderer.send('start-game', {
      nick: selectedAcc.name,
      accountType: selectedAcc.type,
      authData: selectedAcc.authData || null,
      instanceId: selectedInst.id,
      version: selectedInst.version,
      loader: selectedInst.loader,
      ram: state.ram,
      javaType: state.javaType,
      javaCustomPath: state.javaCustomPath
    });
  });
}

ipcRenderer.on('log-message', (event, data) => log(data.type, data.message));
ipcRenderer.on('launch-progress', (event, progress) => {
  if (progress && progress.percentage) {
    if (progressFill) progressFill.style.width = `${progress.percentage}%`;
    if (statusBox) statusBox.textContent = `Загрузка: ${Math.round(progress.percentage)}%`;
  }
});
ipcRenderer.on('game-closed', () => {
  if (playBtn) { playBtn.disabled = false; playBtn.textContent = 'ИГРАТЬ'; }
  if (statusBox) statusBox.textContent = 'Ожидание действий...';
  if (progressFill) progressFill.style.width = '0%';
});

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
async function init() {
  const data = await ipcRenderer.invoke('get-init-data');
  state.accounts = normalizeAccounts(data.accounts);
  state.selectedAccountId = data.selectedAccountId || (state.accounts[0] ? state.accounts[0].id : '');
  state.instances = Array.isArray(data.instances) && data.instances.length > 0 ? data.instances : [{ id: 'Стандартная 1.20.1', name: 'Стандартная 1.20.1', version: '1.20.1', loader: 'vanilla' }];
  state.selectedInstanceId = data.selectedInstanceId || state.instances[0].id;
  state.versions = data.versions || [];
  state.ram = data.ram || 4;
  state.maxRam = data.maxRam || 16;
  state.javaType = data.javaType || 'auto';
  state.javaCustomPath = data.javaCustomPath || '';
  state.theme = data.theme || DEFAULT_THEME;
  state.customPresets = Array.isArray(data.customPresets) ? data.customPresets : [];

  applyTheme(state.theme);
  loadThemeToInputs(state.theme);
  renderPresetSelect();

  if (ramRange) { ramRange.max = state.maxRam; ramRange.value = state.ram; }
  if (ramValue) ramValue.textContent = `${state.ram.toFixed(1)} ГБ`;

  if (javaTypeSelect) javaTypeSelect.value = state.javaType;
  if (javaCustomPathInput) javaCustomPathInput.value = state.javaCustomPath;
  if (javaCustomGroup) javaCustomGroup.style.display = state.javaType === 'custom' ? 'block' : 'none';

  if (versionSelect) {
    versionSelect.innerHTML = '';
    state.versions.forEach(ver => {
      const opt = document.createElement('option');
      opt.value = ver;
      opt.textContent = ver;
      versionSelect.appendChild(opt);
    });
  }

  const currentAcc = state.accounts.find(a => a.id === state.selectedAccountId);
  if (currentAcc && accountTypeSelect) accountTypeSelect.value = currentAcc.type || 'offline';

  updateAccountTypeUI();
  renderInstances();
}

init();