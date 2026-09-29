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
  javaCustomPath: ''
};

// Элементы DOM
const accountTypeSelect = document.getElementById('accountTypeSelect');
const accountSelect = document.getElementById('accountSelect');
const offlineAddRow = document.getElementById('offlineAddRow');
const msAuthRow = document.getElementById('msAuthRow');
const newNickInput = document.getElementById('newNickInput');
const addNickBtn = document.getElementById('addNickBtn');
const msLoginBtn = document.getElementById('msLoginBtn');
const removeNickBtn = document.getElementById('removeNickBtn');

const instancesGrid = document.getElementById('instancesGrid');
const toggleAddInstanceBtn = document.getElementById('toggleAddInstanceBtn');
const addInstanceBlock = document.getElementById('addInstanceBlock');
const newInstanceName = document.getElementById('newInstanceName');
const versionSelect = document.getElementById('versionSelect');
const loaderSelect = document.getElementById('loaderSelect');
const createInstanceBtn = document.getElementById('createInstanceBtn');
const cancelInstanceBtn = document.getElementById('cancelInstanceBtn');

const ramRange = document.getElementById('ramRange');
const ramValue = document.getElementById('ramValue');
const javaTypeSelect = document.getElementById('javaTypeSelect');
const javaCustomGroup = document.getElementById('javaCustomGroup');
const javaCustomPathInput = document.getElementById('javaCustomPathInput');
const browseJavaBtn = document.getElementById('browseJavaBtn');

const consoleBox = document.getElementById('consoleBox');
const clearConsoleBtn = document.getElementById('clearConsoleBtn');
const statusBox = document.getElementById('statusBox');
const progressFill = document.getElementById('progressFill');
const playBtn = document.getElementById('playBtn');

function log(type, message) {
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
    javaCustomPath: state.javaCustomPath
  });
}

function renderAccounts() {
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

function renderInstances() {
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
      if (e.target.classList.contains('open-folder-btn') || e.target.classList.contains('delete-inst-btn')) return;
      state.selectedInstanceId = inst.id;
      renderInstances();
      saveState();
    });

    card.querySelector('.open-folder-btn').addEventListener('click', () => {
      ipcRenderer.invoke('open-instance-folder', inst.id);
    });

    card.querySelector('.delete-inst-btn').addEventListener('click', async () => {
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

    instancesGrid.appendChild(card);
  });
}

function updateAccountTypeUI() {
  const type = accountTypeSelect.value;
  if (type === 'microsoft') {
    offlineAddRow.style.display = 'none';
    msAuthRow.style.display = 'flex';
  } else {
    offlineAddRow.style.display = 'flex';
    msAuthRow.style.display = 'none';
  }
  renderAccounts();
}

async function init() {
  const data = await ipcRenderer.invoke('get-init-data');
  state.accounts = normalizeAccounts(data.accounts);
  state.selectedAccountId = data.selectedAccountId || (state.accounts[0] ? state.accounts[0].id : '');
  state.instances = data.instances;
  state.selectedInstanceId = data.selectedInstanceId;
  state.versions = data.versions;
  state.ram = data.ram;
  state.maxRam = data.maxRam || 16;
  state.javaType = data.javaType;
  state.javaCustomPath = data.javaCustomPath;

  ramRange.max = state.maxRam;
  ramRange.value = state.ram;
  ramValue.textContent = `${state.ram.toFixed(1)} ГБ`;

  javaTypeSelect.value = state.javaType;
  javaCustomPathInput.value = state.javaCustomPath;
  javaCustomGroup.style.display = state.javaType === 'custom' ? 'block' : 'none';

  versionSelect.innerHTML = '';
  state.versions.forEach(ver => {
    const opt = document.createElement('option');
    opt.value = ver;
    opt.textContent = ver;
    versionSelect.appendChild(opt);
  });

  const currentAcc = state.accounts.find(a => a.id === state.selectedAccountId);
  if (currentAcc) {
    accountTypeSelect.value = currentAcc.type || 'offline';
  }

  updateAccountTypeUI();
  renderInstances();
}

// Аккаунты
accountTypeSelect.addEventListener('change', updateAccountTypeUI);

addNickBtn.addEventListener('click', () => {
  const nick = newNickInput.value.trim();
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
  newNickInput.value = '';
  renderAccounts();
  saveState();
  log('info', `Добавлен профиль: ${nick}`);
});

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

accountSelect.addEventListener('change', () => {
  if (accountSelect.value) {
    state.selectedAccountId = accountSelect.value;
    saveState();
  }
});

removeNickBtn.addEventListener('click', () => {
  if (state.accounts.length <= 1) {
    log('error', 'Нельзя удалить единственный профиль!');
    return;
  }

  state.accounts = state.accounts.filter(a => a.id !== state.selectedAccountId);
  if (state.accounts.length > 0) {
    state.selectedAccountId = state.accounts[0].id;
    accountTypeSelect.value = state.accounts[0].type || 'offline';
    updateAccountTypeUI();
  }

  renderAccounts();
  saveState();
  log('info', 'Профиль удален.');
});

// Сборки
toggleAddInstanceBtn.addEventListener('click', () => {
  addInstanceBlock.style.display = addInstanceBlock.style.display === 'none' ? 'flex' : 'none';
});

cancelInstanceBtn.addEventListener('click', () => {
  addInstanceBlock.style.display = 'none';
});

createInstanceBtn.addEventListener('click', () => {
  const name = newInstanceName.value.trim();
  if (!name) {
    log('error', 'Введите название сборки!');
    return;
  }

  const newInst = {
    id: name,
    name: name,
    version: versionSelect.value,
    loader: loaderSelect.value
  };

  state.instances.push(newInst);
  state.selectedInstanceId = newInst.id;
  newInstanceName.value = '';
  addInstanceBlock.style.display = 'none';
  renderInstances();
  saveState();
  log('info', `Создана сборка "${name}" (${newInst.loader} ${newInst.version})`);
});

// Настройки
ramRange.addEventListener('input', () => {
  state.ram = parseFloat(ramRange.value);
  ramValue.textContent = `${state.ram.toFixed(1)} ГБ`;
  saveState();
});

javaTypeSelect.addEventListener('change', () => {
  state.javaType = javaTypeSelect.value;
  javaCustomGroup.style.display = state.javaType === 'custom' ? 'block' : 'none';
  saveState();
});

browseJavaBtn.addEventListener('click', async () => {
  const p = await ipcRenderer.invoke('select-java-file');
  if (p) {
    javaCustomPathInput.value = p;
    state.javaCustomPath = p;
    saveState();
  }
});

javaCustomPathInput.addEventListener('change', () => {
  state.javaCustomPath = javaCustomPathInput.value;
  saveState();
});

clearConsoleBtn.addEventListener('click', () => {
  consoleBox.innerHTML = '';
});

// Игра
playBtn.addEventListener('click', () => {
  const selectedAcc = state.accounts.find(a => a.id === state.selectedAccountId);
  const selectedInst = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];

  if (!selectedAcc || !selectedInst) {
    log('error', 'Выберите профиль и сборку!');
    return;
  }

  playBtn.disabled = true;
  playBtn.textContent = 'ЗАПУСК...';
  statusBox.textContent = 'Подготовка к запуску...';
  progressFill.style.width = '0%';

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

ipcRenderer.on('log-message', (event, data) => log(data.type, data.message));

ipcRenderer.on('launch-progress', (event, progress) => {
  if (progress && progress.percentage) {
    progressFill.style.width = `${progress.percentage}%`;
    statusBox.textContent = `Загрузка: ${Math.round(progress.percentage)}%`;
  }
});

ipcRenderer.on('game-closed', () => {
  playBtn.disabled = false;
  playBtn.textContent = 'ИГРАТЬ';
  statusBox.textContent = 'Ожидание действий...';
  progressFill.style.width = '0%';
});

init();


// ==========================================
// MOD MANAGER (Modrinth + Vanilla Block)
// ==========================================

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

let activeTab = 'search';

// ПРОВЕРКА И БЛОКИРОВКА УСТАНОВКИ НА VANILLA
if (openModManagerBtn) {
  openModManagerBtn.addEventListener('click', () => {
    const currentInstance = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
    if (!currentInstance) return;

    if (!currentInstance.loader || currentInstance.loader.toLowerCase() === 'vanilla') {
      log('error', 'На чистую Ваниллу нельзя ставить моды! Создайте или выберите сборку с Fabric или Forge.');
      alert('На ванильную версию Minecraft нельзя устанавливать моды!\nСначала создайте или выберите сборку с загрузчиком (Fabric или Forge).');
      return;
    }

    modManagerInstanceName.textContent = currentInstance.name;
    modManagerInstanceDetails.textContent = `${currentInstance.version} (${currentInstance.loader.toUpperCase()})`;
    
    modManagerModal.style.display = 'flex';
    switchTab('search');
    performModSearch();
  });
}

if (closeModManagerBtn) {
  closeModManagerBtn.addEventListener('click', () => {
    modManagerModal.style.display = 'none';
  });
}

if (tabSearchMods && tabInstalledMods) {
  tabSearchMods.addEventListener('click', () => switchTab('search'));
  tabInstalledMods.addEventListener('click', () => switchTab('installed'));
}

function switchTab(tab) {
  activeTab = tab;
  if (tab === 'search') {
    tabSearchMods.classList.add('active');
    tabInstalledMods.classList.remove('active');
    modSearchTabContent.style.display = 'flex';
    modInstalledTabContent.style.display = 'none';
  } else {
    tabInstalledMods.classList.add('active');
    tabSearchMods.classList.remove('active');
    modSearchTabContent.style.display = 'none';
    modInstalledTabContent.style.display = 'flex';
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
  if (!currentInstance) return;

  const query = modSearchInput.value.trim();

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

    modSearchResults.appendChild(card);
  });
}

async function loadInstalledMods() {
  const currentInstance = state.instances.find(i => i.id === state.selectedInstanceId) || state.instances[0];
  if (!currentInstance) return;

  installedModsList.innerHTML = `<div style="text-align: center; color: var(--sage-primary); padding: 20px; font-size: 11px;">Загрузка списка...</div>`;

  const files = await ipcRenderer.invoke('get-installed-mods', currentInstance.id);

  if (files.length === 0) {
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

    card.querySelector('.delete-mod-btn').addEventListener('click', async () => {
      if (confirm(`Удалить мод ${file}?`)) {
        await ipcRenderer.invoke('delete-mod', { instanceId: currentInstance.id, filename: file });
        loadInstalledMods();
      }
    });

    installedModsList.appendChild(card);
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}