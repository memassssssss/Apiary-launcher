const { ipcRenderer } = require('electron');

// ==========================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ==========================================
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

// ==========================================
// ЭЛЕМЕНТЫ DOM
// ==========================================

// Аккаунты
const accountTypeSelect = document.getElementById('accountTypeSelect');
const accountSelect = document.getElementById('accountSelect');
const offlineAddRow = document.getElementById('offlineAddRow');
const msAuthRow = document.getElementById('msAuthRow');
const newNickInput = document.getElementById('newNickInput');
const addNickBtn = document.getElementById('addNickBtn');
const msLoginBtn = document.getElementById('msLoginBtn');
const removeNickBtn = document.getElementById('removeNickBtn');

// Сборки (Экземпляры)
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

// Модальное окно темы и пресетов
const openThemeEditorBtn = document.getElementById('openThemeEditorBtn');
const closeThemeEditorBtn = document.getElementById('closeThemeEditorBtn');
const cancelThemeBtn = document.getElementById('cancelThemeBtn');
const themeEditorModal = document.getElementById('themeEditorModal');
const saveThemeBtn = document.getElementById('saveThemeBtn');
const resetThemeBtn = document.getElementById('resetThemeBtn');
const browseBgBtn = document.getElementById('browseBgBtn');
const bgImageUrlInput = document.getElementById('bgImageUrlInput');
const artSection = document.querySelector('.art-section');

const presetSelect = document.getElementById('presetSelect');
const applyPresetBtn = document.getElementById('applyPresetBtn');
const deletePresetBtn = document.getElementById('deletePresetBtn');
const newPresetNameInput = document.getElementById('newPresetNameInput');
const savePresetBtn = document.getElementById('savePresetBtn');

// Менеджер модов
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


// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function log(type, message) {
  if (!consoleBox) return;
  const line = document.createElement('div');
  line.className = `log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function normalizeAccounts(rawAccounts) {
  if (!Array.isArray(rawAccounts)) return [{ id: 'offline_Player', name: 'Player', type: 'offline' }];
  return rawAccounts.map(acc => {
    if (typeof acc === 'string') {
      return { id: `offline_${acc}`, name: acc, type: 'offline' };
    }
    return acc;
  });
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
// УПРАВЛЕНИЕ ТЕМАМИ И ПРЕСЕТАМИ
// ==========================================

const DEFAULT_THEME = {
  bgImage: './bac.gif',
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
    name: 'Sage (Зеленый по умолчанию)',
    theme: { ...DEFAULT_THEME }
  },
  {
    id: 'preset_sakura',
    name: 'Sakura (Нежно-розовый)',
    theme: {
      bgImage: './bac.gif',
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
    name: 'Honey (Нежно-желтый)',
    theme: {
      bgImage: './bac.gif',
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
    artSection.style.backgroundImage = `url("${t.bgImage.replace(/\\/g, '/')}")`;
  }

  Object.entries(THEME_CSS_MAP).forEach(([key, cssVar]) => {
    if (t[key]) {
      document.documentElement.style.setProperty(cssVar, t[key]);
    }
  });
}

function loadThemeToInputs(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  if (bgImageUrlInput) bgImageUrlInput.value = t.bgImage;

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
        if (/^#[0-9A-F]{6}$/i.test(textEl.value)) {
          colorEl.value = textEl.value;
        }
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

  if (state.customPresets.length > 0) {
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
  const isCustom = state.customPresets.some(p => p.id === selectedId);
  deletePresetBtn.style.display = isCustom ? 'inline-block' : 'none';
}

if (presetSelect) {
  presetSelect.addEventListener('change', updatePresetButtons);
}

if (applyPresetBtn) {
  applyPresetBtn.addEventListener('click', () => {
    const selectedId = presetSelect.value;
    let targetPreset = BUILTIN_PRESETS.find(p => p.id === selectedId);
    if (!targetPreset) {
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
      bgImage: bgImageUrlInput ? bgImageUrlInput.value.trim() : DEFAULT_THEME.bgImage
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

    state.customPresets.push(newPreset);
    if (newPresetNameInput) newPresetNameInput.value = '';

    renderPresetSelect();
    if (presetSelect) presetSelect.value = newPreset.id;
    updatePresetButtons();

    applyTheme(currentThemeFromInputs);
    saveState();
    log('info', `Сохранен пресет темы: "${name}"`);
  });
}

if (deletePresetBtn) {
  deletePresetBtn.addEventListener('click', () => {
    const selectedId = presetSelect.value;
    const preset = state.customPresets.find(p => p.id === selectedId);
    if (!preset) return;

    if (confirm(`Удалить пользовательский пресет "${preset.name}"?`)) {
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

const closeThemeModal = () => {
  if (themeEditorModal) themeEditorModal.style.display = 'none';
};

if (closeThemeEditorBtn) closeThemeEditorBtn.addEventListener('click', closeThemeModal);
if (cancelThemeBtn) cancelThemeBtn.addEventListener('click', closeThemeModal);

if (browseBgBtn) {
  browseBgBtn.addEventListener('click', async () => {
    const filePath = await ipcRenderer.invoke('select-bg-file');
    if (filePath && bgImageUrlInput) {
      bgImageUrlInput.value = filePath;
    }
  });
}

if (saveThemeBtn) {
  saveThemeBtn.addEventListener('click', () => {
    const newTheme = {
      bgImage: bgImageUrlInput ? bgImageUrlInput.value.trim() : DEFAULT_THEME.bgImage
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
// УПРАВЛЕНИЕ АККАУНТАМИ
// ==========================================

function updateAccountTypeUI() {
  if (!accountTypeSelect) return;
  const type = accountTypeSelect.value;
  if (type === 'microsoft') {
    if (offlineAddRow) offlineAddRow.style.display = 'none';
    if (msAuthRow) msAuthRow.style.display = 'flex';
  } else {
    if (offlineAddRow) offlineAddRow.style.display = 'flex';
    if (msAuthRow) msAuthRow.style.display = 'none';
  }
  renderAccounts();
}

function renderAccounts() {
  if (!accountSelect || !accountTypeSelect) return;
  accountSelect.innerHTML = '';
  
  const selectedType = accountTypeSelect.value;
  const filteredAccounts = state.accounts.filter(acc => (acc.type || 'offline') === selectedType);

  if (filteredAccounts.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = selectedType === 'microsoft' 
      ? '-- Нет аккаунтов Microsoft --' 
      : '-- Нет Offline аккаунтов --';
    accountSelect.appendChild(opt);
    accountSelect.disabled = true;
    state.selectedAccountId = '';
    return;
  }

  accountSelect.disabled = false;
  filteredAccounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = acc.name;
    accountSelect.appendChild(opt);
  });

  const exists = filteredAccounts.some(a => a.id === state.selectedAccountId);
  if (exists) {
    accountSelect.value = state.selectedAccountId;
  } else if (filteredAccounts.length > 0) {
    state.selectedAccountId = filteredAccounts[0].id;
    accountSelect.value = state.selectedAccountId;
    saveState();
  }
}

if (accountTypeSelect) accountTypeSelect.addEventListener('change', updateAccountTypeUI);

if (addNickBtn) {
  addNickBtn.addEventListener('click', () => {
    const nick = newNickInput ? newNickInput.value.trim() : '';
    if (!nick) {
      log('error', 'Введите никнейм!');
      return;
    }

    const id = `offline_${nick}`;
    const existing = state.accounts.find(a => a.id === id);
    if (!existing) {
      state.accounts.push({ id, name: nick, type: 'offline' });
    }
    state.selectedAccountId = id;
    if (newNickInput) newNickInput.value = '';
    renderAccounts();
    saveState();
    log('info', `Добавлен профиль: ${nick}`);
  });
}

if (msLoginBtn) {
  msLoginBtn.addEventListener('click', async () => {
    msLoginBtn.disabled = true;
    msLoginBtn.textContent = 'Авторизация...';
    log('info', 'Запуск входа Microsoft...');

    const res = await ipcRenderer.invoke('ms-login');
    msLoginBtn.disabled = false;
    msLoginBtn.textContent = 'Войти через Microsoft';

    if (res.success) {
      const acc = res.account;
      const idx = state.accounts.findIndex(a => a.id === acc.id);
      if (idx >= 0) state.accounts[idx] = acc;
      else state.accounts.push(acc);
      
      state.selectedAccountId = acc.id;
      renderAccounts();
      saveState();
      log('info', `Успешный вход: ${acc.name}`);
    } else {
      log('error', `Ошибка входа: ${res.error}`);
    }
  });
}

if (accountSelect) {
  accountSelect.addEventListener('change', () => {
    if (accountSelect.value) {
      state.selectedAccountId = accountSelect.value;
      saveState();
    }
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
    log('info', 'Профиль удален.');
  });
}


// ==========================================
// УПРАВЛЕНИЕ СБОРКАМИ (INSTANCES)
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

    const folderBtn = card.querySelector('.open-folder-btn');
    if (folderBtn) {
      folderBtn.addEventListener('click', () => {
        ipcRenderer.invoke('open-instance-folder', inst.id);
      });
    }

    const deleteBtn = card.querySelector('.delete-inst-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (state.instances.length <= 1) {
          log('error', 'Нельзя удалить единственную сборку!');
          return;
        }
        await ipcRenderer.invoke('delete-instance', inst.id);
        state.instances = state.instances.filter(i => i.id !== inst.id);
        if (state.selectedInstanceId === inst.id) {
          state.selectedInstanceId = state.instances[0].id;
        }
        renderInstances();
        saveState();
        log('info', `Сборка "${inst.name}" удалена.`);
      });
    }

    instancesGrid.appendChild(card);
  });
}

if (toggleAddInstanceBtn) {
  toggleAddInstanceBtn.addEventListener('click', () => {
    if (addInstanceBlock) {
      addInstanceBlock.style.display = addInstanceBlock.style.display === 'none' ? 'flex' : 'none';
    }
  });
}

if (cancelInstanceBtn) {
  cancelInstanceBtn.addEventListener('click', () => {
    if (addInstanceBlock) addInstanceBlock.style.display = 'none';
  });
}

if (createInstanceBtn) {
  createInstanceBtn.addEventListener('click', () => {
    const name = newInstanceName ? newInstanceName.value.trim() : '';
    if (!name) {
      log('error', 'Введите название сборки!');
      return;
    }

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
    log('info', `Создана сборка "${name}" (${newInst.loader} ${newInst.version})`);
  });
}


// ==========================================
// НАСТРОЙКИ (RAM И JAVA)
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
    if (javaCustomGroup) {
      javaCustomGroup.style.display = state.javaType === 'custom' ? 'block' : 'none';
    }
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

if (javaCustomPathInput) {
  javaCustomPathInput.addEventListener('change', () => {
    state.javaCustomPath = javaCustomPathInput.value;
    saveState();
  });
}

if (clearConsoleBtn) {
  clearConsoleBtn.addEventListener('click', () => {
    if (consoleBox) consoleBox.innerHTML = '';
  });
}


// ==========================================
// ЗАПУСК ИГРЫ
// ==========================================

if (playBtn) {
  playBtn.addEventListener('click', () => {
    const selectedAcc = state.accounts.find(a => a.id === state.selectedAccountId);
    const selectedInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];

    if (!selectedAcc || !selectedInst) {
      log('error', 'Выберите профиль и сборку!');
      return;
    }

    playBtn.disabled = true;
    playBtn.textContent = 'ЗАПУСК...';
    if (statusBox) statusBox.textContent = 'Подготовка к запуску...';
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
  if (playBtn) {
    playBtn.disabled = false;
    playBtn.textContent = 'ИГРАТЬ';
  }
  if (statusBox) statusBox.textContent = 'Ожидание действий...';
  if (progressFill) progressFill.style.width = '0%';
});


// ==========================================
// МЕНЕДЖЕР МОДОВ (MODRINTH)
// ==========================================

let activeTab = 'search';

if (openModManagerBtn) {
  openModManagerBtn.addEventListener('click', () => {
    const currentInstance = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
    if (!currentInstance) return;

    if (!currentInstance.loader || currentInstance.loader.toLowerCase() === 'vanilla') {
      log('error', 'На чистую Ваниллу нельзя ставить моды! Создайте или выберите сборку с Fabric или Forge.');
      alert('На ванильную версию Minecraft нельзя устанавливать моды!\nСначала создайте или выберите сборку с загрузчиком (Fabric или Forge).');
      return;
    }

    if (modManagerInstanceName) modManagerInstanceName.textContent = currentInstance.name;
    if (modManagerInstanceDetails) modManagerInstanceDetails.textContent = `${currentInstance.version} (${currentInstance.loader.toUpperCase()})`;
    
    if (modManagerModal) modManagerModal.style.display = 'flex';
    switchTab('search');
    performModSearch();
  });
}

if (closeModManagerBtn) {
  closeModManagerBtn.addEventListener('click', () => {
    if (modManagerModal) modManagerModal.style.display = 'none';
  });
}

if (tabSearchMods && tabInstalledMods) {
  tabSearchMods.addEventListener('click', () => switchTab('search'));
  tabInstalledMods.addEventListener('click', () => switchTab('installed'));
}

function switchTab(tab) {
  activeTab = tab;
  if (tab === 'search') {
    if (tabSearchMods) tabSearchMods.classList.add('active');
    if (tabInstalledMods) tabInstalledMods.classList.remove('active');
    if (modSearchTabContent) modSearchTabContent.style.display = 'flex';
    if (modInstalledTabContent) modInstalledTabContent.style.display = 'none';
  } else {
    if (tabInstalledMods) tabInstalledMods.classList.add('active');
    if (tabSearchMods) tabSearchMods.classList.remove('active');
    if (modSearchTabContent) modSearchTabContent.style.display = 'none';
    if (modInstalledTabContent) modInstalledTabContent.style.display = 'flex';
    loadInstalledMods();
  }
}

if (modSearchBtn) modSearchBtn.addEventListener('click', performModSearch);
if (modSearchInput) {
  modSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performModSearch();
  });
}

async function performModSearch() {
  const currentInstance = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
  if (!currentInstance || !modSearchResults) return;

  const query = modSearchInput ? modSearchInput.value.trim() : '';

  modSearchResults.innerHTML = `<div style="text-align: center; color: var(--sage-primary); padding: 20px; font-size: 11px;">Поиск модов на Modrinth...</div>`;

  const res = await ipcRenderer.invoke('search-mods', {
    query,
    version: currentInstance.version,
    loader: currentInstance.loader
  });

  if (!res.success) {
    modSearchResults.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px; font-size: 11px;">Ошибка поиска: ${escapeHtml(res.error || 'Неизвестная ошибка')}</div>`;
    return;
  }

  if (!res.hits || res.hits.length === 0) {
    modSearchResults.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px; font-size: 11px;">Ничего не найдено для ядра ${currentInstance.loader.toUpperCase()}.</div>`;
    return;
  }

  renderSearchResults(res.hits, currentInstance);
}

function renderSearchResults(hits, currentInstance) {
  if (!modSearchResults) return;
  modSearchResults.innerHTML = '';

  hits.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'mod-card';

    const iconHtml = mod.icon_url 
      ? `<img class="mod-icon" src="${mod.icon_url}" alt="icon">` 
      : `<div class="mod-icon">📦</div>`;

    const downloads = mod.downloads ? mod.downloads.toLocaleString() : '0';

    card.innerHTML = `
      ${iconHtml}
      <div class="mod-details">
        <div class="mod-title-row">
          <span class="mod-name">${escapeHtml(mod.title)}</span>
          <span class="mod-author">by ${escapeHtml(mod.author || 'Unknown')}</span>
        </div>
        <div class="mod-description">${escapeHtml(mod.description || 'Без описания')}</div>
        <div class="mod-stats">
          <span>⬇ ${downloads}</span>
        </div>
      </div>
      <button class="btn-install" data-id="${mod.project_id}">Установить</button>
    `;

    const installBtn = card.querySelector('.btn-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        installBtn.disabled = true;
        installBtn.textContent = 'Скачка...';

        const installRes = await ipcRenderer.invoke('install-mod', {
          projectId: mod.project_id,
          instanceId: currentInstance.id,
          mcVersion: currentInstance.version,
          loader: currentInstance.loader
        });

        if (installRes.success) {
          installBtn.textContent = '✓ Установлен';
          installBtn.style.background = 'var(--border-soft)';
          installBtn.style.color = 'var(--sage-primary)';
        } else {
          alert(`Ошибка установки: ${installRes.error}`);
          installBtn.disabled = false;
          installBtn.textContent = 'Установить';
        }
      });
    }

    modSearchResults.appendChild(card);
  });
}

async function loadInstalledMods() {
  const currentInstance = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
  if (!currentInstance || !installedModsList) return;

  installedModsList.innerHTML = `<div style="text-align: center; color: var(--sage-primary); padding: 20px; font-size: 11px;">Загрузка списка...</div>`;

  const files = await ipcRenderer.invoke('get-installed-mods', currentInstance.id);

  if (!files || files.length === 0) {
    installedModsList.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px; font-size: 11px;">В этой сборке пока нет модов.</div>`;
    return;
  }

  installedModsList.innerHTML = '';
  files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    card.innerHTML = `
      <div class="mod-icon">🧩</div>
      <div class="mod-details">
        <span class="mod-name" style="font-size: 9px;">${escapeHtml(file)}</span>
      </div>
      <button class="btn-action btn-danger delete-mod-btn">Удалить</button>
    `;

    const deleteBtn = card.querySelector('.delete-mod-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Удалить мод ${file}?`)) {
          await ipcRenderer.invoke('delete-mod', { instanceId: currentInstance.id, filename: file });
          loadInstalledMods();
        }
      });
    }

    installedModsList.appendChild(card);
  });
}


// ==========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАПУСКЕ
// ==========================================

async function init() {
  const data = await ipcRenderer.invoke('get-init-data');
  state.accounts = normalizeAccounts(data.accounts);
  state.selectedAccountId = data.selectedAccountId || (state.accounts[0] ? state.accounts[0].id : '');
  
  state.instances = Array.isArray(data.instances) && data.instances.length > 0
    ? data.instances
    : [{ id: 'ApiaryDefault', name: 'Apiary Craft', version: '1.20.1', loader: 'vanilla' }];
    
  state.selectedInstanceId = data.selectedInstanceId || state.instances[0].id;
  state.versions = data.versions || [];
  state.ram = data.ram || 4;
  state.maxRam = data.maxRam || 16;
  state.javaType = data.javaType || 'auto';
  state.javaCustomPath = data.javaCustomPath || '';
  state.theme = data.theme || DEFAULT_THEME;
  state.customPresets = Array.isArray(data.customPresets) ? data.customPresets : [];

  // Инициализация темы и пресетов
  applyTheme(state.theme);
  loadThemeToInputs(state.theme);
  renderPresetSelect();

  // Инициализация ползунка RAM
  if (ramRange) {
    ramRange.max = state.maxRam;
    ramRange.value = state.ram;
  }
  if (ramValue) ramValue.textContent = `${state.ram.toFixed(1)} ГБ`;

  // Инициализация конфигурации Java
  if (javaTypeSelect) javaTypeSelect.value = state.javaType;
  if (javaCustomPathInput) javaCustomPathInput.value = state.javaCustomPath;
  if (javaCustomGroup) javaCustomGroup.style.display = state.javaType === 'custom' ? 'block' : 'none';

  // Инициализация выпадающего списка версий
  if (versionSelect) {
    versionSelect.innerHTML = '';
    state.versions.forEach(ver => {
      const opt = document.createElement('option');
      opt.value = ver;
      opt.textContent = ver;
      versionSelect.appendChild(opt);
    });
  }

  // Настройка UI профилей
  const currentAcc = state.accounts.find(a => a.id === state.selectedAccountId);
  if (currentAcc && accountTypeSelect) {
    accountTypeSelect.value = currentAcc.type || 'offline';
  }

  updateAccountTypeUI();
  renderInstances();
}

init();