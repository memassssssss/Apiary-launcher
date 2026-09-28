const { ipcRenderer } = require('electron');

const accountSelect = document.getElementById('accountSelect');
const newNickInput = document.getElementById('newNickInput');
const addNickBtn = document.getElementById('addNickBtn');
const removeNickBtn = document.getElementById('removeNickBtn');

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

const playBtn = document.getElementById('playBtn');
const statusBox = document.getElementById('statusBox');
const progressFill = document.getElementById('progressFill');
const consoleBox = document.getElementById('consoleBox');
const clearConsoleBtn = document.getElementById('clearConsoleBtn');

let state = {
  accounts: [],
  selectedAccount: '',
  ram: 4,
  maxRam: 16,
  versions: [],
  instances: [],
  selectedInstanceId: '',
  javaType: 'auto',
  javaCustomPath: ''
};

function logToConsole(type, message) {
  const line = document.createElement('div');
  line.className = `log-${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

// Преобразуем имя сборки в безопасное название папки
function sanitizeFolderName(name) {
  let safe = name.replace(/[\\/:*?"<>|]/g, '').trim();
  return safe || 'Сборка';
}

function generateUniqueId(name, instances) {
  const base = sanitizeFolderName(name);
  let id = base;
  let counter = 1;
  const existingIds = new Set(instances.map(i => i.id));
  while (existingIds.has(id)) {
    counter++;
    id = `${base} (${counter})`;
  }
  return id;
}

function saveData() {
  ipcRenderer.send('save-data', state);
}

async function init() {
  state = await ipcRenderer.invoke('get-init-data');
  renderUI();
  logToConsole('info', 'Apiary Launcher инициализирован.');
}

init();

accountSelect.addEventListener('change', (e) => {
  state.selectedAccount = e.target.value;
  saveData();
});

addNickBtn.addEventListener('click', () => {
  const nick = newNickInput.value.trim();
  if (!nick) return;
  if (!state.accounts.includes(nick)) {
    state.accounts.push(nick);
  }
  state.selectedAccount = nick;
  newNickInput.value = '';
  renderUI();
  saveData();
});

removeNickBtn.addEventListener('click', () => {
  if (state.accounts.length <= 1) {
    alert('Нельзя удалить единственный профиль.');
    return;
  }
  state.accounts = state.accounts.filter(a => a !== state.selectedAccount);
  state.selectedAccount = state.accounts[0];
  renderUI();
  saveData();
});

// Открытие / закрытие формы создания
toggleAddInstanceBtn.addEventListener('click', () => {
  const isHidden = addInstanceBlock.style.display === 'none' || !addInstanceBlock.style.display;
  addInstanceBlock.style.display = isHidden ? 'flex' : 'none';
});

cancelInstanceBtn.addEventListener('click', () => {
  addInstanceBlock.style.display = 'none';
});

// Создание сборки
createInstanceBtn.addEventListener('click', () => {
  const name = newInstanceName.value.trim();
  if (!name) {
    alert('Введите название сборки!');
    return;
  }
  const version = versionSelect.value;
  const loader = loaderSelect.value;

  const id = generateUniqueId(name, state.instances);
  const newInst = { id, name, version, loader };

  state.instances.push(newInst);
  state.selectedInstanceId = id;

  newInstanceName.value = '';
  addInstanceBlock.style.display = 'none';

  renderUI();
  saveData();
  logToConsole('info', `Создана сборка "${name}" (Папка: instances/${id}, Ядро: ${loader.toUpperCase()})`);
});

ramRange.addEventListener('input', (e) => {
  state.ram = parseFloat(e.target.value);
  ramValue.textContent = `${state.ram} ГБ`;
  saveData();
});

javaTypeSelect.addEventListener('change', (e) => {
  state.javaType = e.target.value;
  javaCustomGroup.style.display = state.javaType === 'custom' ? 'flex' : 'none';
  saveData();
});

browseJavaBtn.addEventListener('click', async () => {
  const chosen = await ipcRenderer.invoke('select-java-file');
  if (chosen) {
    state.javaCustomPath = chosen;
    javaCustomPathInput.value = chosen;
    saveData();
  }
});

playBtn.addEventListener('click', () => {
  const currentInst = state.instances.find(i => i.id === state.selectedInstanceId);
  if (!currentInst) return;

  playBtn.disabled = true;
  statusBox.textContent = 'Подготовка к запуску...';
  progressFill.style.width = '0%';

  ipcRenderer.send('start-game', {
    nick: state.selectedAccount,
    instanceId: currentInst.id,
    version: currentInst.version,
    loader: currentInst.loader || 'vanilla',
    ram: state.ram,
    javaType: state.javaType,
    javaCustomPath: state.javaCustomPath
  });
});

clearConsoleBtn.addEventListener('click', () => {
  consoleBox.innerHTML = '';
});

ipcRenderer.on('log-message', (e, data) => {
  logToConsole(data.type, data.message);
});

ipcRenderer.on('launch-progress', (e, progress) => {
  if (progress && progress.type) {
    statusBox.textContent = `Загрузка: ${progress.type} (${progress.task || 0}/${progress.total || 0})`;
    if (progress.total > 0) {
      const pct = Math.round((progress.task / progress.total) * 100);
      progressFill.style.width = `${pct}%`;
    }
  }
});

ipcRenderer.on('game-closed', () => {
  playBtn.disabled = false;
  statusBox.textContent = 'Ожидание действий...';
  progressFill.style.width = '0%';
});

// Полное удаление сборки с диска и из состояния
async function deleteInstance(instanceId) {
  if (state.instances.length <= 1) {
    alert('Нельзя удалить единственную сборку.');
    return;
  }

  if (!confirm(`Вы уверены, что хотите полностью удалить сборку "${instanceId}" с диска?`)) {
    return;
  }

  try {
    // 1. Удаление папки с диска через IPC в main.js
    await ipcRenderer.invoke('delete-instance', instanceId);

    // 2. Обновление состояния
    state.instances = state.instances.filter(inst => inst.id !== instanceId);

    if (state.selectedInstanceId === instanceId) {
      state.selectedInstanceId = state.instances.length > 0 ? state.instances[0].id : '';
    }

    // 3. Сохранение и перерисовка
    saveData();
    renderUI();
    logToConsole('info', `Сборка "${instanceId}" успешно удалена.`);
  } catch (err) {
    alert(`Ошибка при удалении сборки: ${err.message}`);
    logToConsole('error', `Ошибка удаления сборки ${instanceId}: ${err.message}`);
  }
}

function renderUI() {
  accountSelect.innerHTML = '';
  state.accounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc;
    opt.textContent = acc;
    if (acc === state.selectedAccount) opt.selected = true;
    accountSelect.appendChild(opt);
  });

  ramRange.max = state.maxRam;
  ramRange.value = state.ram;
  ramValue.textContent = `${state.ram} ГБ`;

  versionSelect.innerHTML = '';
  state.versions.forEach(ver => {
    const opt = document.createElement('option');
    opt.value = ver;
    opt.textContent = ver;
    versionSelect.appendChild(opt);
  });

  renderInstances();

  javaTypeSelect.value = state.javaType;
  javaCustomPathInput.value = state.javaCustomPath;
  javaCustomGroup.style.display = state.javaType === 'custom' ? 'flex' : 'none';
}

function renderInstances() {
  const grid = document.getElementById('instancesGrid');
  if (!grid) return;
  
  grid.innerHTML = '';

  state.instances.forEach(inst => {
    const isActive = inst.id === state.selectedInstanceId;
    const card = document.createElement('div');
    card.className = `instance-card ${isActive ? 'active' : ''}`;
    
    card.innerHTML = `
      <div class="instance-title" title="${inst.name}">${inst.name}</div>
      <div class="instance-meta">
        <span class="badge-loader">${inst.loader || 'vanilla'}</span>
        <span>${inst.version}</span>
      </div>
      <div class="instance-actions">
        <button class="btn-icon open-folder-btn" title="Папка сборки">📁</button>
        <button class="btn-icon btn-danger delete-inst-btn" title="Удалить">🗑️</button>
      </div>
    `;

    // Клик по карточке для выбора сборки
    card.addEventListener('click', () => {
      state.selectedInstanceId = inst.id;
      renderUI();
      saveData();
    });

    // Кнопка папки
    card.querySelector('.open-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      ipcRenderer.invoke('open-instance-folder', inst.id);
    });

    // Кнопка удаления
    card.querySelector('.delete-inst-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteInstance(inst.id);
    });

    grid.appendChild(card);
  });
}