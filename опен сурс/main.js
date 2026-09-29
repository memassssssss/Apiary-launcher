const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const Store = require('electron-store');
const { Auth } = require('msmc');
const { ensureJava } = require('./javaManager');

const store = new Store();
const launcher = new Client();

let isLaunching = false;
let mainWindow;

function extractMajorVersion(version) {
  if (!version) return null;
  const parts = String(version).split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}

function getOfflineUuid(username) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

function fetchJson(url, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 
        'User-Agent': 'Apiary-Launcher',
        ...customHeaders 
      }
    };

    https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location, customHeaders).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        const err = new Error(`HTTP status ${res.statusCode} for ${url}`);
        err.statusCode = res.statusCode;
        return reject(err);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFileWithRedirects(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'Apiary-Launcher' } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return request(response.headers.location);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`Ошибка скачивания: HTTP status ${response.statusCode}`));
        }

        const totalSize = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedSize = 0;
        let lastReportedProgress = -1;

        const fileStream = fs.createWriteStream(dest);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0 && onProgress) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            if (progress !== lastReportedProgress) {
              lastReportedProgress = progress;
              onProgress(progress);
            }
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(resolve);
        });

        fileStream.on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
      }).on('error', reject);
    };

    request(url);
  });
}

async function prepareFabric(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[Fabric] Поиск версий Fabric Loader для Minecraft ${mcVersion}...`);
  let loaders;
  try {
    loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  } catch (e) {
    const major = extractMajorVersion(mcVersion);
    if (major && major !== mcVersion) {
      logToClient('info', `[Fabric] Пробуем найти профиль для базовой версии ${major}...`);
      try {
        loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${major}`);
      } catch (err) {}
    }
  }
  
  if (!loaders || loaders.length === 0) {
    throw new Error(`Fabric недоступен для версии Minecraft ${mcVersion}`);
  }

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
    logToClient('info', `[Fabric] Профиль Fabric успешно установлен.`);
  }

  return customVersionId;
}

async function prepareForge(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[Forge] Поиск релизов Forge для Minecraft ${mcVersion}...`);
  const promosData = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
  const promos = promosData.promos || {};

  const major = extractMajorVersion(mcVersion);
  const forgeVersion = promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`] || promos[`${major}-recommended`] || promos[`${major}-latest`];
  
  if (!forgeVersion) {
    throw new Error(`Версия Forge не найдена для Minecraft ${mcVersion}`);
  }

  const fullForgeId = `${mcVersion}-${forgeVersion}`;
  logToClient('info', `[Forge] Найдена подходящая версия Forge: ${fullForgeId}`);

  const versionsDir = path.join(launcherRoot, 'versions');
  if (fs.existsSync(versionsDir)) {
    const files = fs.readdirSync(versionsDir);
    const existingForge = files.find(f => f.toLowerCase().includes('forge') && (f.includes(mcVersion) || (major && f.includes(major))));
    if (existingForge && fs.existsSync(path.join(versionsDir, existingForge, `${existingForge}.json`))) {
      logToClient('info', `[Forge] Найден ранее установленный Forge профиль: ${existingForge}`);
      return { customVersion: existingForge };
    }
  }

  const installerName = `forge-${fullForgeId}-installer.jar`;
  const installerPath = path.join(launcherRoot, installerName);

  if (!fs.existsSync(installerPath)) {
    const downloadUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeId}/${installerName}`;
    logToClient('info', `[Forge] Скачивание инсталлятора Forge...`);
    await downloadFileWithRedirects(downloadUrl, installerPath, (p) => {
      logToClient('info', `[Forge] Загрузка: ${p}%`);
    });
  }

  return { installerPath };
}

function fetchVersions() {
  return new Promise((resolve, reject) => {
    https.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const manifest = JSON.parse(data);
          const releases = manifest.versions
            .filter(v => v.type === 'release')
            .map(v => v.id);
          resolve(releases);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 780,
    minWidth: 920,
    minHeight: 680,
    resizable: true,
    autoHideMenuBar: true,
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
  let versions = [];
  try {
    versions = await fetchVersions();
  } catch (e) {
    versions = ['1.21.11', '1.20.1', '1.16.5', '1.12.2', '1.7.10'];
  }

  const defaultInstances = [
    { id: 'Стандартная 1.20.1', name: 'Стандартная 1.20.1', version: '1.20.1', loader: 'vanilla' }
  ];

  const defaultAccounts = [
    { id: 'offline_Player', name: 'Player', type: 'offline' }
  ];

  return {
    accounts: store.get('accounts', defaultAccounts),
    selectedAccountId: store.get('selectedAccountId', 'offline_Player'),
    ram: store.get('ram', 4),
    maxRam: totalMemGb,
    versions: versions,
    javaType: store.get('javaType', 'auto'),
    javaCustomPath: store.get('javaCustomPath', ''),
    instances: store.get('instances', defaultInstances),
    selectedInstanceId: store.get('selectedInstanceId', 'Стандартная 1.20.1')
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
});

ipcMain.handle('select-java-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите исполняемый файл Java (javaw.exe) или папку',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Исполняемые файлы Java', extensions: ['exe', 'bin'] },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-instance-folder', async (event, instanceId) => {
  const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
  const instanceDir = path.join(rootPath, 'instances', instanceId || 'Стандартная');
  const minecraftDir = path.join(instanceDir, 'minecraft');

  if (!fs.existsSync(minecraftDir)) {
    fs.mkdirSync(path.join(minecraftDir, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(minecraftDir, 'config'), { recursive: true });
    fs.mkdirSync(path.join(minecraftDir, 'saves'), { recursive: true });
    fs.mkdirSync(path.join(minecraftDir, 'resourcepacks'), { recursive: true });
  }

  await shell.openPath(instanceDir);
});

ipcMain.handle('delete-instance', async (event, instanceId) => {
  if (!instanceId) return false;
  const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
  const instanceDir = path.join(rootPath, 'instances', instanceId);

  try {
    if (fs.existsSync(instanceDir)) {
      fs.rmSync(instanceDir, { recursive: true, force: true });
    }
    return true;
  } catch (err) {
    return false;
  }
});

function resolveJavaExecutable(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Путь не существует: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return inputPath;

  if (stat.isDirectory()) {
    const execName = process.platform === 'win32' ? 'javaw.exe' : 'java';
    const cand = path.join(inputPath, 'bin', execName);
    if (fs.existsSync(cand)) return cand;
    if (fs.existsSync(path.join(inputPath, execName))) return path.join(inputPath, execName);
  }

  throw new Error(`Не удалось найти javaw.exe в ${inputPath}`);
}

ipcMain.on('start-game', async (event, config) => {
  const logToClient = (type, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', { type, message });
    }
  };

  if (isLaunching) return;
  isLaunching = true;

  const unlockLauncher = () => {
    isLaunching = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game-closed');
    }
  };

  const { nick, accountType, authData, instanceId, version, loader, ram, javaType, javaCustomPath } = config;
  
  let authObject;
  if (accountType === 'microsoft' && authData) {
    authObject = authData;
    logToClient('info', `Режим авторизации: Microsoft — ${authObject.name}`);
  } else {
    authObject = {
      access_token: "offline_token",
      refresh_token: "offline_refresh",
      uuid: getOfflineUuid(nick),
      name: nick || "Player",
      user_type: "mojang"
    };
    logToClient('info', `Режим авторизации: Offline — ${nick}`);
  }
  
  const launcherRoot = path.join(app.getPath('appData'), '.apiary-launcher');
  const instancePath = path.join(launcherRoot, 'instances', instanceId || 'Стандартная', 'minecraft');

  if (!fs.existsSync(instancePath)) {
    fs.mkdirSync(path.join(instancePath, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(instancePath, 'config'), { recursive: true });
  }

  try {
    let targetJavaPath = '';
    if (javaType === 'custom' && javaCustomPath) {
      targetJavaPath = resolveJavaExecutable(javaCustomPath.trim().replace(/^["']|["']$/g, ''));
    } else {
      targetJavaPath = await ensureJava(launcherRoot, 21, logToClient);
    }

    let versionConfig = { number: version, type: "release" };
    let forgeInstallerPath = null;

    if (loader === 'fabric') {
      versionConfig.custom = await prepareFabric(launcherRoot, version, logToClient);
    } else if (loader === 'forge') {
      const forgeRes = await prepareForge(launcherRoot, version, logToClient);
      if (forgeRes.customVersion) versionConfig.custom = forgeRes.customVersion;
      else if (forgeRes.installerPath) forgeInstallerPath = forgeRes.installerPath;
    }

    let opts = {
      authorization: authObject,
      root: launcherRoot,
      version: versionConfig,
      memory: { max: `${Math.round(ram * 1024)}M`, min: "1024M" },
      javaPath: targetJavaPath,
      overrides: { detached: true, windowsHide: true, gameDirectory: instancePath }
    };

    if (forgeInstallerPath) opts.forge = forgeInstallerPath;

    logToClient('info', `Запуск: "${instanceId}" [${loader.toUpperCase()}] ${version}`);

    launcher.removeAllListeners();
    launcher.on('debug', (e) => logToClient('debug', e));
    launcher.on('data', (e) => logToClient('game', e));
    launcher.on('progress', (p) => mainWindow && mainWindow.webContents.send('launch-progress', p));
    launcher.on('close', (c) => { unlockLauncher(); });

    await launcher.launch(opts);

  } catch (err) {
    logToClient('error', `Ошибка запуска: ${err.message}`);
    unlockLauncher();
  }
});


// ==========================================
// МЕНЕДЖЕР МОДОВ (ПОИСК И УСТАНОВКА ЧЕРЕЗ MODRINTH)
// ==========================================

// Умный поиск подходящего файла на Modrinth
function pickBestModrinthVersion(versions, mcVersion, loader) {
  if (!versions || versions.length === 0) return null;

  const cleanLoader = (loader || '').toLowerCase();
  const majorVersion = extractMajorVersion(mcVersion);

  const isLoaderMatch = (ver) => {
    if (!cleanLoader || cleanLoader === 'vanilla') return true;
    if (!ver.loaders || !Array.isArray(ver.loaders)) return false;
    const l = ver.loaders.map(x => x.toLowerCase());
    if (l.includes(cleanLoader)) return true;
    if (cleanLoader === 'fabric' && l.includes('quilt')) return true;
    if (cleanLoader === 'neoforge' && l.includes('forge')) return true;
    return false;
  };

  const isExactVersionMatch = (ver) => {
    return ver.game_versions && ver.game_versions.includes(mcVersion);
  };

  const isMajorVersionMatch = (ver) => {
    if (!ver.game_versions) return false;
    return ver.game_versions.some(v => v === majorVersion || (majorVersion && v.startsWith(majorVersion)));
  };

  let best = versions.find(v => isLoaderMatch(v) && isExactVersionMatch(v));
  if (best) return best;

  best = versions.find(v => isLoaderMatch(v) && isMajorVersionMatch(v));
  if (best) return best;

  best = versions.find(v => isLoaderMatch(v));
  if (best) return best;

  return versions[0];
}

ipcMain.handle('get-installed-mods', async (event, instanceId) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    const modsDir = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', 'mods');

    if (!fs.existsSync(modsDir)) {
      return [];
    }

    const files = fs.readdirSync(modsDir);
    return files.filter(f => f.endsWith('.jar') || f.endsWith('.disabled'));
  } catch (err) {
    console.error('Error getting installed mods:', err);
    return [];
  }
});

ipcMain.handle('delete-mod', async (event, { instanceId, filename }) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    const modPath = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', 'mods', filename);

    if (fs.existsSync(modPath)) {
      fs.unlinkSync(modPath);
    }
    return { success: true };
  } catch (err) {
    console.error('Error deleting mod:', err);
    return { success: false, error: err.message };
  }
});

// Поиск модов на Modrinth
ipcMain.handle('search-mods', async (event, { query, version, loader }) => {
  try {
    const cleanLoader = loader ? loader.toLowerCase() : 'fabric';
    const majorVersion = extractMajorVersion(version);
    const searchQuery = encodeURIComponent(query || '');

    const fetchModrinthHits = async (vFilter, lFilter) => {
      const facets = [['project_type:mod']];
      if (vFilter) facets.push([`versions:${vFilter}`]);
      if (lFilter && lFilter !== 'vanilla') facets.push([`categories:${lFilter}`]);

      const url = `https://api.modrinth.com/v2/search?query=${searchQuery}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=20`;
      try {
        const res = await fetchJson(url);
        return res.hits || [];
      } catch (e) {
        return [];
      }
    };

    let hits = await fetchModrinthHits(version, cleanLoader);
    if (hits.length === 0 && majorVersion && majorVersion !== version) {
      hits = await fetchModrinthHits(majorVersion, cleanLoader);
    }
    if (hits.length === 0) {
      hits = await fetchModrinthHits(null, cleanLoader);
    }
    if (hits.length === 0) {
      hits = await fetchModrinthHits(null, null);
    }

    return { success: true, hits };
  } catch (err) {
    console.error('Search error:', err);
    return { success: false, error: err.message };
  }
});

// Установка мода с Modrinth
ipcMain.handle('install-mod', async (event, { projectId, instanceId, mcVersion, loader }) => {
  try {
    const rootPath = path.join(app.getPath('appData'), '.apiary-launcher');
    const modsDir = path.join(rootPath, 'instances', instanceId || 'Стандартная', 'minecraft', 'mods');
    const cleanLoader = loader ? loader.toLowerCase() : 'fabric';

    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const versionsUrl = `https://api.modrinth.com/v2/project/${projectId}/version`;
    let versions = [];
    try {
      const res = await fetchJson(versionsUrl);
      versions = Array.isArray(res) ? res : [];
    } catch (e) {}

    const targetVersion = pickBestModrinthVersion(versions, mcVersion, cleanLoader);

    if (!targetVersion) {
      throw new Error(`Совместимая версия мода не найдена на Modrinth`);
    }

    const primaryFile = targetVersion.files.find(f => f.primary) || targetVersion.files[0];
    if (!primaryFile || !primaryFile.url) {
      throw new Error('Файл мода недоступен для скачивания.');
    }

    const destPath = path.join(modsDir, primaryFile.filename);
    await downloadFileWithRedirects(primaryFile.url, destPath);
    return { success: true, filename: primaryFile.filename };
  } catch (err) {
    console.error('Install error:', err);
    return { success: false, error: err.message };
  }
});