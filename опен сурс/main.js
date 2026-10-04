const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage, net } = require('electron');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const Store = require('electron-store');
const { Auth } = require('msmc');
const { ensureJava, getRecommendedJavaVersion, verifyJavaBinary } = require('./javaManager');

const store = new Store();
let isLaunching = false;
let mainWindow;

const CF_API_KEY = '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';

function extractMajorVersion(version) {
  if (!version) return null;
  const parts = String(version).split('.');
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return version;
}

function getOfflineUuid(username) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '3' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

/**
 * Надежный сетевой запрос через Chromium-стек Electron с автоматической
 * распаковкой gzip/brotli, следованием редиректам и жестким таймаутом
 */
async function fetchJson(url, customHeaders = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await net.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ApiaryLauncher/2.1.0 (contact@apiary.local)',
        'Accept': 'application/json',
        ...customHeaders
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${response.statusText})`);
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Превышено время ожидания ответа сервера (${timeoutMs / 1000} сек)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Скачивание файлов с прогрессом через Chromium net.fetch
 */
async function downloadFileWithRedirects(url, dest, onProgress) {
  const response = await net.fetch(url, {
    headers: { 'User-Agent': 'ApiaryLauncher/2.1.0' }
  });

  if (!response.ok) {
    throw new Error(`Ошибка загрузки: HTTP ${response.status} (${response.statusText})`);
  }

  const totalSize = parseInt(response.headers.get('content-length'), 10) || 0;
  let downloadedSize = 0;
  let lastReportedProgress = -1;

  const fileStream = fs.createWriteStream(dest);
  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      downloadedSize += value.length;
      fileStream.write(Buffer.from(value));

      if (totalSize > 0 && onProgress) {
        const progress = Math.round((downloadedSize / totalSize) * 100);
        if (progress !== lastReportedProgress) {
          lastReportedProgress = progress;
          onProgress(progress);
        }
      }
    }
  } finally {
    await new Promise(resolve => fileStream.end(resolve));
  }
}

// ----------------------------------------------------
// ЗАГРУЗЧИКИ (FABRIC, QUILT, FORGE, NEOFORGE)
// ----------------------------------------------------
async function prepareFabric(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[Fabric] Запрос версий Fabric Loader для MC ${mcVersion}...`);
  let loaders;
  try {
    loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  } catch (e) {
    const major = extractMajorVersion(mcVersion);
    if (major && major !== mcVersion) {
      try { loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${major}`); } catch (err) {}
    }
  }
  if (!loaders || loaders.length === 0) throw new Error(`Fabric недоступен для версии ${mcVersion}`);

  const loaderVersion = loaders[0].loader.version;
  const customVersionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(launcherRoot, 'versions', customVersionId);
  const versionJsonPath = path.join(versionDir, `${customVersionId}.json`);

  if (!fs.existsSync(versionJsonPath)) {
    logToClient('info', `[Fabric] Скачивание профиля Fabric Loader ${loaderVersion}...`);
    let profileJson;
    try {
      profileJson = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
    } catch (e) {
      const major = extractMajorVersion(mcVersion);
      profileJson = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${major}/${loaderVersion}/profile/json`);
    }
    fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(profileJson, null, 2));
    logToClient('info', `[Fabric] Профиль сохранен: ${customVersionId}`);
  }
  return customVersionId;
}

async function prepareQuilt(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[Quilt] Запрос версий Quilt Loader для MC ${mcVersion}...`);
  let loaders;
  try {
    loaders = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
  } catch (e) {
    const major = extractMajorVersion(mcVersion);
    if (major && major !== mcVersion) {
      try { loaders = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${major}`); } catch (err) {}
    }
  }
  if (!loaders || loaders.length === 0) throw new Error(`Quilt недоступен для версии ${mcVersion}`);

  const loaderVersion = loaders[0].loader.version;
  const customVersionId = `quilt-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(launcherRoot, 'versions', customVersionId);
  const versionJsonPath = path.join(versionDir, `${customVersionId}.json`);

  if (!fs.existsSync(versionJsonPath)) {
    logToClient('info', `[Quilt] Скачивание профиля Quilt Loader ${loaderVersion}...`);
    let profileJson;
    try {
      profileJson = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
    } catch (e) {
      const major = extractMajorVersion(mcVersion);
      profileJson = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${major}/${loaderVersion}/profile/json`);
    }
    fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(profileJson, null, 2));
    logToClient('info', `[Quilt] Профиль сохранен: ${customVersionId}`);
  }
  return customVersionId;
}

async function prepareForge(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[Forge] Получение промо-манифеста Forge...`);
  const promosData = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
  const promos = promosData.promos || {};

  const major = extractMajorVersion(mcVersion);
  const forgeVersion = promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`] || promos[`${major}-recommended`] || promos[`${major}-latest`];
  if (!forgeVersion) throw new Error(`Версия Forge не найдена для Minecraft ${mcVersion}`);

  const fullForgeId = `${mcVersion}-${forgeVersion}`;
  const versionsDir = path.join(launcherRoot, 'versions');
  if (fs.existsSync(versionsDir)) {
    const files = fs.readdirSync(versionsDir);
    const existing = files.find(f => f.toLowerCase().includes('forge') && f.includes(mcVersion) && f.includes(forgeVersion));
    if (existing && fs.existsSync(path.join(versionsDir, existing, `${existing}.json`))) {
      return { customVersion: existing };
    }
  }

  const installerName = `forge-${fullForgeId}-installer.jar`;
  const installerPath = path.join(launcherRoot, installerName);
  if (!fs.existsSync(installerPath)) {
    const downloadUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeId}/${installerName}`;
    logToClient('info', `[Forge] Скачивание инсталлятора Forge...`);
    await downloadFileWithRedirects(downloadUrl, installerPath, p => logToClient('info', `[Forge] Инсталлятор: ${p}%`));
  }
  return { installerPath };
}

async function prepareNeoForge(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[NeoForge] Поиск версий NeoForge для Minecraft ${mcVersion}...`);
  const metaUrl = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';
  let versionsData;
  try {
    versionsData = await fetchJson(metaUrl);
  } catch (e) {
    throw new Error(`Не удалось получить список версий NeoForge: ${e.message}`);
  }

  const allVersions = versionsData.versions || [];
  const cleanVer = mcVersion.replace(/^1\./, '');
  const matched = allVersions.filter(v => v.startsWith(cleanVer) || v.startsWith(mcVersion));
  if (matched.length === 0) throw new Error(`NeoForge не найден для версии Minecraft ${mcVersion}`);

  const targetNeoVer = matched[matched.length - 1];
  logToClient('info', `[NeoForge] Выбрана версия NeoForge: ${targetNeoVer}`);

  const versionsDir = path.join(launcherRoot, 'versions');
  if (fs.existsSync(versionsDir)) {
    const files = fs.readdirSync(versionsDir);
    const existing = files.find(f => f.toLowerCase().includes('neoforge') && f.includes(targetNeoVer));
    if (existing && fs.existsSync(path.join(versionsDir, existing, `${existing}.json`))) {
      return { customVersion: existing };
    }
  }

  const installerName = `neoforge-${targetNeoVer}-installer.jar`;
  const installerPath = path.join(launcherRoot, installerName);
  if (!fs.existsSync(installerPath)) {
    const downloadUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${targetNeoVer}/${installerName}`;
    logToClient('info', `[NeoForge] Скачивание инсталлятора NeoForge...`);
    await downloadFileWithRedirects(downloadUrl, installerPath, p => logToClient('info', `[NeoForge] Инсталлятор: ${p}%`));
  }
  return { installerPath };
}

function resolveJavaExecutable(inputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`Указанный путь не существует: ${inputPath}`);
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return inputPath;
  if (stat.isDirectory()) {
    const execName = process.platform === 'win32' ? 'javaw.exe' : 'java';
    const cand1 = path.join(inputPath, 'bin', execName);
    const cand2 = path.join(inputPath, execName);
    if (fs.existsSync(cand1)) return cand1;
    if (fs.existsSync(cand2)) return cand2;
  }
  throw new Error(`В каталоге "${inputPath}" не найден исполняемый файл Java`);
}

function fetchVersions() {
  return fetchJson('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
    .then(manifest => manifest.versions.filter(v => v.type === 'release').map(v => v.id))
    .catch(() => ['1.21.1', '1.20.1', '1.16.5', '1.12.2', '1.7.10']);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 940,
    minHeight: 700,
    resizable: true,
    autoHideMenuBar: true,
    title: 'Apiary Launcher v2.1.0',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ----------------------------------------------------
// IPC ОБРАБОТЧИКИ
// ----------------------------------------------------
ipcMain.handle('ms-login', async () => {
  try {
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.launch("electron");
    const token = await xboxManager.getMinecraft();
    const mclcAuth = token.mclc();
    return {
      success: true,
      account: {
        id: `ms_${mclcAuth.uuid}`,
        name: mclcAuth.name,
        type: 'microsoft',
        authData: mclcAuth
      }
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('get-init-data', async () => {
  const totalMemGb = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
  const versions = await fetchVersions();

  return {
    accounts: store.get('accounts', [{ id: 'offline_Player', name: 'Player', type: 'offline' }]),
    selectedAccountId: store.get('selectedAccountId', 'offline_Player'),
    ram: store.get('ram', 4),
    maxRam: totalMemGb,
    versions: versions,
    javaType: store.get('javaType', 'auto'),
    javaCustomPath: store.get('javaCustomPath', ''),
    instances: store.get('instances', [{ id: 'Стандартная 1.20.1', name: 'Стандартная 1.20.1', version: '1.20.1', loader: 'vanilla' }]),
    selectedInstanceId: store.get('selectedInstanceId', 'Стандартная 1.20.1'),
    theme: store.get('theme', null),
    customPresets: store.get('customPresets', [])
  };
});

ipcMain.on('save-data', (event, data) => {
  if (data.accounts) store.set('accounts', data.accounts);
  if (data.selectedAccountId) store.set('selectedAccountId', data.selectedAccountId);
  if (data.ram) store.set('ram', data.ram);
  if (data.javaType) store.set('javaType', data.javaType);
  if (data.javaCustomPath !== undefined) store.set('javaCustomPath', data.javaCustomPath);
  if (data.instances) store.set('instances', data.instances);
  if (data.selectedInstanceId) store.set('selectedInstanceId', data.selectedInstanceId);
  if (data.theme !== undefined) store.set('theme', data.theme);
  if (data.customPresets !== undefined) store.set('customPresets', data.customPresets);
});

ipcMain.handle('select-java-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите исполняемый файл Java (javaw.exe) или папку',
    properties: ['openFile', 'openDirectory'],
    filters: [{ name: 'Исполняемые файлы Java', extensions: ['exe', 'bin'] }, { name: 'Все файлы', extensions: ['*'] }]
  });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

ipcMain.handle('select-bg-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите фоновое изображение',
    properties: ['openFile'],
    filters: [{ name: 'Изображения', extensions: ['gif', 'png', 'jpg', 'jpeg', 'webp'] }, { name: 'Все файлы', extensions: ['*'] }]
  });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

ipcMain.handle('open-instance-folder', async (event, instanceId) => {
  const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
  const instanceDir = path.join(rootPath, 'instances', instanceId || 'Стандартная');
  const mcDir = path.join(instanceDir, 'minecraft');
  ['mods', 'shaderpacks', 'resourcepacks', 'config', 'saves', 'screenshots'].forEach(sub => {
    fs.mkdirSync(path.join(mcDir, sub), { recursive: true });
  });
  await shell.openPath(instanceDir);
});

ipcMain.handle('delete-instance', async (event, instanceId) => {
  if (!instanceId) return false;
  const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
  const instanceDir = path.join(rootPath, 'instances', instanceId);
  try {
    if (fs.existsSync(instanceDir)) fs.rmSync(instanceDir, { recursive: true, force: true });
    return true;
  } catch (err) { return false; }
});

// ----------------------------------------------------
// СКРИНШОТЫ
// ----------------------------------------------------
ipcMain.handle('get-screenshots', async (event, instanceId) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    const screenshotsDir = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) return [];

    const files = fs.readdirSync(screenshotsDir);
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

    return files
      .filter(f => validExtensions.includes(path.extname(f).toLowerCase()))
      .map(f => {
        const fullPath = path.join(screenshotsDir, f);
        const stats = fs.statSync(fullPath);
        return {
          name: f,
          path: fullPath,
          url: `file://${fullPath.replace(/\\/g, '/')}`,
          mtime: stats.mtimeMs,
          size: stats.size
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('copy-screenshot-to-clipboard', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const img = nativeImage.createFromPath(filePath);
    clipboard.writeImage(img);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('delete-screenshot', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) {}
  return false;
});

// ----------------------------------------------------
// ЗАПУСК ИГРЫ
// ----------------------------------------------------
ipcMain.on('start-game', async (event, config) => {
  const logToClient = (type, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', { type, message });
    }
  };

  if (isLaunching) {
    logToClient('warn', '[Запуск] Игра уже запускается.');
    return;
  }
  isLaunching = true;

  const unlockLauncher = () => {
    if (!isLaunching) return;
    isLaunching = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game-closed');
    }
  };

  const { nick, accountType, authData, instanceId, version, loader, ram, javaType, javaCustomPath } = config;

  try {
    logToClient('info', '==================================================');
    logToClient('info', `[Apiary Launcher] Запуск Minecraft ${version} (${loader.toUpperCase()})`);

    let authObject;
    if (accountType === 'microsoft' && authData) {
      authObject = authData;
      logToClient('info', `[Auth] Microsoft: ${authObject.name}`);
    } else {
      const offlineUuid = getOfflineUuid(nick);
      authObject = {
        access_token: "offline_token",
        refresh_token: "offline_refresh",
        uuid: offlineUuid,
        name: nick || "Player",
        user_type: "mojang"
      };
      logToClient('info', `[Auth] Offline: ${authObject.name}`);
    }

    const launcherRoot = path.join(app.getPath('appData'), '.apiary-launcher');
    const instancePath = path.join(launcherRoot, 'instances', instanceId || 'Стандартная', 'minecraft');

    ['mods', 'shaderpacks', 'resourcepacks', 'config', 'saves', 'screenshots'].forEach(dir => {
      fs.mkdirSync(path.join(instancePath, dir), { recursive: true });
    });

    let targetJavaPath = '';
    let javaVersionNum = 21;
    if (javaType === 'custom' && javaCustomPath) {
      targetJavaPath = resolveJavaExecutable(javaCustomPath.trim().replace(/^["']|["']$/g, ''));
      const customCheck = await verifyJavaBinary(targetJavaPath);
      logToClient('info', `[Java] Пользовательская Java: ${customCheck.versionString}`);
    } else {
      javaVersionNum = getRecommendedJavaVersion(version);
      logToClient('info', `[Java] Рекомендуемая среда: Java ${javaVersionNum}`);
      targetJavaPath = await ensureJava(launcherRoot, javaVersionNum, logToClient);
    }

    let versionConfig = { number: version, type: "release" };
    let customInstaller = null;

    if (loader === 'fabric') {
      versionConfig.custom = await prepareFabric(launcherRoot, version, logToClient);
    } else if (loader === 'quilt') {
      versionConfig.custom = await prepareQuilt(launcherRoot, version, logToClient);
    } else if (loader === 'forge') {
      const forgeRes = await prepareForge(launcherRoot, version, logToClient);
      if (forgeRes.customVersion) versionConfig.custom = forgeRes.customVersion;
      else if (forgeRes.installerPath) customInstaller = forgeRes.installerPath;
    } else if (loader === 'neoforge') {
      const neoRes = await prepareNeoForge(launcherRoot, version, logToClient);
      if (neoRes.customVersion) versionConfig.custom = neoRes.customVersion;
      else if (neoRes.installerPath) customInstaller = neoRes.installerPath;
    }

    const maxRamMb = Math.round(ram * 1024);
    const minRamMb = Math.min(1024, maxRamMb);

    const customJvmArgs = [];
    if (javaVersionNum >= 21) {
      customJvmArgs.push('-XX:+UseZGC', '-XX:+ZGenerational');
      logToClient('info', `[JVM Opts] Включен высокопроизводительный сборщик ZGC (-XX:+UseZGC -XX:+ZGenerational)`);
    }

    const opts = {
      authorization: authObject,
      root: launcherRoot,
      version: versionConfig,
      memory: { max: `${maxRamMb}M`, min: `${minRamMb}M` },
      javaPath: targetJavaPath,
      customArgs: customJvmArgs,
      overrides: { detached: true, windowsHide: true, gameDirectory: instancePath }
    };

    if (customInstaller) opts.forge = customInstaller;

    const client = new Client();
    let lastLoggedAssetQuarter = -1;

    client.on('debug', (msg) => logToClient('debug', msg));
    client.on('data', (data) => {
      const line = String(data).trim();
      if (!line) return;
      if (line.includes('ERROR') || line.includes('Exception') || line.includes('FATAL')) logToClient('error', line);
      else if (line.includes('WARN')) logToClient('warn', line);
      else logToClient('game', line);
    });

    client.on('progress', (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launch-progress', progress);
      }
      if (progress && progress.type) {
        if (progress.type === 'assets') {
          const currentQuarter = Math.floor((progress.percentage || 0) / 25) * 25;
          if (currentQuarter !== lastLoggedAssetQuarter) {
            lastLoggedAssetQuarter = currentQuarter;
            logToClient('debug', `[Ассеты] Проверка и загрузка ресурсов игры: ${currentQuarter}%`);
          }
        } else {
          logToClient('debug', `[Загрузка] ${progress.type}: ${progress.task || ''} (${Math.round(progress.percentage || 0)}%)`);
        }
      }
    });

    client.on('close', (code) => {
      logToClient('info', `[Процесс] Игра завершилась с кодом ${code}`);
      unlockLauncher();
    });

    client.on('error', (err) => {
      logToClient('error', `[Ошибка запуска] ${err.message || err}`);
      unlockLauncher();
    });

    logToClient('info', `[Старт] Запуск клиента игры...`);
    const proc = await client.launch(opts);
    if (proc && proc.pid) {
      logToClient('info', `[Успех] Процесс запущен (PID: ${proc.pid})!`);
    }

  } catch (err) {
    logToClient('error', `[Критическая ошибка] ${err.message}`);
    unlockLauncher();
  }
});

// ----------------------------------------------------
// МОДЫ, ШЕЙДЕРЫ И ТЕКСТУР-ПАКИ (БЕЗ ЗАВИСАНИЙ)
// ----------------------------------------------------
ipcMain.handle('get-installed-content', async (event, { instanceId, type }) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    let folderName = 'mods';
    if (type === 'shader') folderName = 'shaderpacks';
    else if (type === 'resourcepack') folderName = 'resourcepacks';

    const contentDir = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', folderName);
    if (!fs.existsSync(contentDir)) return [];

    const files = fs.readdirSync(contentDir);
    return files.filter(f => f.endsWith('.jar') || f.endsWith('.zip') || f.endsWith('.disabled'));
  } catch (err) {
    return [];
  }
});

ipcMain.handle('delete-content-file', async (event, { instanceId, type, filename }) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    let folderName = 'mods';
    if (type === 'shader') folderName = 'shaderpacks';
    else if (type === 'resourcepack') folderName = 'resourcepacks';

    const filePath = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', folderName, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('search-content', async (event, { query, version, loader, type, source }) => {
  try {
    const cleanLoader = (loader || 'fabric').toLowerCase().trim();
    const searchQuery = encodeURIComponent((query || '').trim());
    const cleanVer = (version || '').trim();
    const majorVer = extractMajorVersion(cleanVer);

    // 1. MODRINTH
    if (source === 'modrinth') {
      const indexSort = searchQuery ? 'relevance' : 'downloads';

      const buildFacets = (vFilter) => {
        const facets = [];
        if (type === 'shader') {
          facets.push(['project_type:shader']);
        } else if (type === 'resourcepack') {
          facets.push(['project_type:resourcepack']);
        } else {
          facets.push(['project_type:mod']);
          if (cleanLoader && cleanLoader !== 'vanilla') {
            facets.push([`categories:${cleanLoader}`]);
          }
        }

        // Шейдеры и текстур-паки не привязываем строго к микроверсии игры,
        // чтобы не убивать результаты поиска!
        if (type === 'mod' && vFilter) {
          facets.push([`versions:${vFilter}`]);
        }
        return facets;
      };

      const executeModrinthSearch = async (facets) => {
        const url = `https://api.modrinth.com/v2/search?query=${searchQuery}&facets=${encodeURIComponent(JSON.stringify(facets))}&index=${indexSort}&limit=20`;
        const res = await fetchJson(url);
        return res.hits || [];
      };

      let hits = [];
      try {
        // Попытка 1: С точной версией (для модов)
        hits = await executeModrinthSearch(buildFacets(cleanVer));

        // Если для редкой сборки (например, 1.21.11) ничего нет, пробуем 1.21.1
        if (hits.length === 0 && type === 'mod' && cleanVer.startsWith('1.21') && cleanVer !== '1.21.1') {
          hits = await executeModrinthSearch(buildFacets('1.21.1'));
        }
        // Попытка 2: Базовая версия 1.21
        if (hits.length === 0 && type === 'mod' && majorVer && majorVer !== cleanVer) {
          hits = await executeModrinthSearch(buildFacets(majorVer));
        }
        // Попытка 3: Без фильтра версии, но под нужный загрузчик (Fabric/Forge)
        if (hits.length === 0 && type === 'mod') {
          hits = await executeModrinthSearch(buildFacets(null));
        }
      } catch (err) {
        return { success: false, error: `Modrinth недоступен: ${err.message}` };
      }

      return {
        success: true,
        items: hits.map(h => ({
          id: h.project_id,
          source: 'modrinth',
          title: h.title,
          author: h.author,
          description: h.description,
          iconUrl: h.icon_url,
          downloads: h.downloads
        }))
      };
    }

    // 2. CURSEFORGE
    if (source === 'curseforge') {
      let classId = 6; // Mods
      if (type === 'shader') classId = 6552;
      else if (type === 'resourcepack') classId = 12;

      let modLoaderType = 0;
      if (type === 'mod') {
        if (cleanLoader === 'forge') modLoaderType = 1;
        else if (cleanLoader === 'fabric') modLoaderType = 4;
        else if (cleanLoader === 'quilt') modLoaderType = 5;
        else if (cleanLoader === 'neoforge') modLoaderType = 6;
      }

      const executeCfSearch = async (vFilter) => {
        let cfUrl = `https://api.curseforge.com/v1/mods/search?gameId=432&classId=${classId}&searchFilter=${searchQuery}&pageSize=20`;
        if (modLoaderType > 0) cfUrl += `&modLoaderType=${modLoaderType}`;
        if (type === 'mod' && vFilter) cfUrl += `&gameVersion=${encodeURIComponent(vFilter)}`;

        const cfData = await fetchJson(cfUrl, { 'x-api-key': CF_API_KEY });
        return cfData.data || [];
      };

      let cfList = [];
      try {
        cfList = await executeCfSearch(cleanVer);
        if (cfList.length === 0 && type === 'mod' && cleanVer.startsWith('1.21') && cleanVer !== '1.21.1') {
          cfList = await executeCfSearch('1.21.1');
        }
        if (cfList.length === 0 && type === 'mod' && majorVer && majorVer !== cleanVer) {
          cfList = await executeCfSearch(majorVer);
        }
        if (cfList.length === 0 && type === 'mod') {
          cfList = await executeCfSearch(null);
        }
      } catch (err) {
        return { success: false, error: `CurseForge недоступен: ${err.message}` };
      }

      const items = cfList.map(item => ({
        id: String(item.id),
        source: 'curseforge',
        title: item.name,
        author: item.authors && item.authors[0] ? item.authors[0].name : 'Unknown',
        description: item.summary,
        iconUrl: item.logo ? item.logo.thumbnailUrl : null,
        downloads: item.downloadCount
      }));

      return { success: true, items };
    }

    return { success: false, error: 'Неизвестный источник' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-content-item', async (event, { id, source, type, instanceId, mcVersion, loader }) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    let folderName = 'mods';
    if (type === 'shader') folderName = 'shaderpacks';
    else if (type === 'resourcepack') folderName = 'resourcepacks';

    const destDir = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', folderName);
    fs.mkdirSync(destDir, { recursive: true });

    let downloadUrl = '';
    let targetFilename = '';
    const cleanLoader = (loader || '').toLowerCase().trim();
    const majorVer = extractMajorVersion(mcVersion);

    // Modrinth скачивание
    if (source === 'modrinth') {
      const versionsUrl = `https://api.modrinth.com/v2/project/${id}/version`;
      const versions = await fetchJson(versionsUrl);
      if (!Array.isArray(versions) || versions.length === 0) throw new Error('Файлы не найдены на Modrinth');

      const isLoaderMatch = (v) => {
        if (type === 'shader' || type === 'resourcepack') return true;
        if (!v.loaders || !Array.isArray(v.loaders)) return false;
        const l = v.loaders.map(x => x.toLowerCase());
        if (l.includes(cleanLoader)) return true;
        if (cleanLoader === 'fabric' && l.includes('quilt')) return true;
        if (cleanLoader === 'neoforge' && l.includes('forge')) return true;
        return false;
      };

      let best = versions.find(v => isLoaderMatch(v) && v.game_versions && v.game_versions.includes(mcVersion));
      if (!best && mcVersion.startsWith('1.21')) {
        best = versions.find(v => isLoaderMatch(v) && v.game_versions && v.game_versions.includes('1.21.1'));
      }
      if (!best && majorVer) {
        best = versions.find(v => isLoaderMatch(v) && v.game_versions && v.game_versions.some(gv => gv === majorVer || gv.startsWith(majorVer)));
      }
      if (!best) {
        best = versions.find(v => isLoaderMatch(v)) || versions[0];
      }

      const primaryFile = best.files.find(f => f.primary) || best.files[0];
      downloadUrl = primaryFile.url;
      targetFilename = primaryFile.filename;
    }

    // CurseForge скачивание
    if (source === 'curseforge') {
      const filesUrl = `https://api.curseforge.com/v1/mods/${id}/files`;
      const filesData = await fetchJson(filesUrl, { 'x-api-key': CF_API_KEY });
      const filesList = filesData.data || [];
      if (filesList.length === 0) throw new Error('Файлы не найдены на CurseForge');

      let targetFile = filesList.find(f => f.gameVersions && f.gameVersions.includes(mcVersion));
      if (!targetFile && mcVersion.startsWith('1.21')) {
        targetFile = filesList.find(f => f.gameVersions && f.gameVersions.includes('1.21.1'));
      }
      if (!targetFile && majorVer) {
        targetFile = filesList.find(f => f.gameVersions && f.gameVersions.some(gv => gv === majorVer || gv.startsWith(majorVer)));
      }
      if (!targetFile) {
        targetFile = filesList[0];
      }

      downloadUrl = targetFile.downloadUrl;
      targetFilename = targetFile.fileName;

      if (!downloadUrl && targetFile.id) {
        const fileIdStr = String(targetFile.id);
        const part1 = fileIdStr.substring(0, 4);
        const part2 = fileIdStr.substring(4);
        downloadUrl = `https://edge.forgecdn.net/files/${parseInt(part1, 10)}/${parseInt(part2, 10)}/${encodeURIComponent(targetFilename)}`;
      }
    }

    if (!downloadUrl) throw new Error('Не удалось получить прямую ссылку на файл');

    const destPath = path.join(destDir, targetFilename);
    await downloadFileWithRedirects(downloadUrl, destPath);
    return { success: true, filename: targetFilename };

  } catch (err) {
    return { success: false, error: err.message };
  }
});