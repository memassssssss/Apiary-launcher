const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const Store = require('electron-store');
const { ensureJava } = require('./javaManager');

const store = new Store();
const launcher = new Client();

let isLaunching = false;
let mainWindow;

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Apiary-Launcher' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode} for ${url}`));
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
  logToClient('info', `[Fabric] Поиск доступных версий Fabric Loader для Minecraft ${mcVersion}...`);
  const loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  
  if (!loaders || loaders.length === 0) {
    throw new Error(`Fabric недоступен для версии Minecraft ${mcVersion}`);
  }

  const loaderVersion = loaders[0].loader.version;
  const customVersionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(launcherRoot, 'versions', customVersionId);
  const versionJsonPath = path.join(versionDir, `${customVersionId}.json`);

  if (!fs.existsSync(versionJsonPath)) {
    logToClient('info', `[Fabric] Скачивание профиля Fabric Loader ${loaderVersion}...`);
    const profileJson = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
    
    fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(profileJson, null, 2));
    logToClient('info', `[Fabric] Профиль Fabric успешно установлен.`);
  } else {
    logToClient('info', `[Fabric] Профиль Fabric уже присутствует в общей папке версий.`);
  }

  return customVersionId;
}

async function prepareForge(launcherRoot, mcVersion, logToClient) {
  logToClient('info', `[Forge] Поиск релиза Forge для Minecraft ${mcVersion}...`);
  const promosData = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
  const promos = promosData.promos || {};

  const forgeVersion = promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`];
  if (!forgeVersion) {
    throw new Error(`Версия Forge не найдена для Minecraft ${mcVersion}`);
  }

  const fullForgeId = `${mcVersion}-${forgeVersion}`;
  logToClient('info', `[Forge] Найдена подходящая версия Forge: ${fullForgeId}`);

  const versionsDir = path.join(launcherRoot, 'versions');
  if (fs.existsSync(versionsDir)) {
    const files = fs.readdirSync(versionsDir);
    const existingForge = files.find(f => f.toLowerCase().includes('forge') && f.includes(mcVersion));
    if (existingForge && fs.existsSync(path.join(versionsDir, existingForge, `${existingForge}.json`))) {
      logToClient('info', `[Forge] Найден ранее установленный Forge профиль: ${existingForge}`);
      return { customVersion: existingForge };
    }
  }

  const installerName = `forge-${fullForgeId}-installer.jar`;
  const installerPath = path.join(launcherRoot, installerName);

  if (!fs.existsSync(installerPath)) {
    const downloadUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeId}/${installerName}`;
    logToClient('info', `[Forge] Скачивание инсталлятора Forge (${installerName})...`);
    await downloadFileWithRedirects(downloadUrl, installerPath, (p) => {
      logToClient('info', `[Forge] Загрузка инсталлятора: ${p}%`);
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

ipcMain.handle('get-init-data', async () => {
  const totalMemGb = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
  let versions = [];
  try {
    versions = await fetchVersions();
  } catch (e) {
    console.error('Ошибка загрузки версий:', e);
    versions = ['1.20.1', '1.16.5', '1.12.2', '1.7.10'];
  }

  const defaultInstances = [
    { id: 'Стандартная 1.20.1', name: 'Стандартная 1.20.1', version: '1.20.1', loader: 'vanilla' }
  ];

  return {
    accounts: store.get('accounts', ['Player']),
    selectedAccount: store.get('selectedAccount', 'Player'),
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
  if (data.selectedAccount) store.set('selectedAccount', data.selectedAccount);
  if (data.ram) store.set('ram', data.ram);
  if (data.javaType) store.set('javaType', data.javaType);
  if (data.javaCustomPath !== undefined) store.set('javaCustomPath', data.javaCustomPath);
  if (data.instances) store.set('instances', data.instances);
  if (data.selectedInstanceId) store.set('selectedInstanceId', data.selectedInstanceId);
});

ipcMain.handle('select-java-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите исполняемый файл Java (javaw.exe) или папку с Java',
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

// Открытие папки сборки в стиле Prism Launcher
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

// Физическое удаление папки сборки с диска
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
    console.error(`Ошибка при удалении папки сборки ${instanceId}:`, err);
    throw err;
  }
});

function resolveJavaExecutable(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Указанный путь к Java не существует: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return inputPath;

  if (stat.isDirectory()) {
    const isWin = process.platform === 'win32';
    const execName = isWin ? 'javaw.exe' : 'java';

    const candidates = [
      path.join(inputPath, 'bin', execName),
      path.join(inputPath, execName)
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand;
    }

    const findInDir = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          const found = findInDir(fullPath);
          if (found) return found;
        } else if (file.name.toLowerCase() === execName.toLowerCase()) {
          return fullPath;
        }
      }
      return null;
    };

    const foundExec = findInDir(inputPath);
    if (foundExec) return foundExec;

    throw new Error(`Не удалось найти ${execName} внутри папки: ${inputPath}`);
  }

  throw new Error(`Некорректный путь: ${inputPath}`);
}

ipcMain.on('start-game', async (event, config) => {
  const logToClient = (type, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', { type, message });
    }
  };

  if (isLaunching) {
    logToClient('info', '[Launcher] Процесс запуска уже идет, повторный клик проигнорирован.');
    return;
  }

  isLaunching = true;

  const unlockLauncher = () => {
    isLaunching = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game-closed');
    }
  };

  const { nick, instanceId, version, loader, ram, javaType, javaCustomPath } = config;
  const userUuid = getOfflineUuid(nick);
  
  const launcherRoot = path.join(app.getPath('appData'), '.apiary-launcher');
  const instanceRoot = path.join(launcherRoot, 'instances', instanceId || 'Стандартная');
  const instancePath = path.join(instanceRoot, 'minecraft');

  if (!fs.existsSync(instancePath)) {
    fs.mkdirSync(path.join(instancePath, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(instancePath, 'config'), { recursive: true });
    fs.mkdirSync(path.join(instancePath, 'saves'), { recursive: true });
    fs.mkdirSync(path.join(instancePath, 'resourcepacks'), { recursive: true });
  }

  try {
    let targetJavaPath = '';

    if (javaType === 'custom' && javaCustomPath && javaCustomPath.trim() !== '') {
      const cleanPath = javaCustomPath.trim().replace(/^["']|["']$/g, '');
      targetJavaPath = resolveJavaExecutable(cleanPath);
      logToClient('info', `Используется пользовательская Java: ${targetJavaPath}`);
    } else {
      logToClient('info', `Проверка/скачивание автономной Java...`);
      targetJavaPath = await ensureJava(launcherRoot, 21, logToClient);
    }

    let versionConfig = {
      number: version,
      type: "release"
    };

    let forgeInstallerPath = null;

    if (loader === 'fabric') {
      const customVer = await prepareFabric(launcherRoot, version, logToClient);
      versionConfig.custom = customVer;
    } else if (loader === 'forge') {
      const forgeRes = await prepareForge(launcherRoot, version, logToClient);
      if (forgeRes.customVersion) {
        versionConfig.custom = forgeRes.customVersion;
      } else if (forgeRes.installerPath) {
        forgeInstallerPath = forgeRes.installerPath;
      }
    }

    let opts = {
      authorization: {
        access_token: "offline_token",
        refresh_token: "offline_refresh",
        uuid: userUuid,
        name: nick || "Player",
        user_type: "mojang"
      },
      root: launcherRoot,
      version: versionConfig,
      memory: {
        max: `${Math.round(ram * 1024)}M`,
        min: "1024M"
      },
      javaPath: targetJavaPath,
      overrides: {
        detached: true,
        windowsHide: true,
        gameDirectory: instancePath
      }
    };

    if (forgeInstallerPath) {
      opts.forge = forgeInstallerPath;
    }

    logToClient('info', `Запуск Minecraft: Ник = ${nick}, Имя сборки = "${instanceId}", Ядро = ${loader.toUpperCase()}, Версия = ${version}, ОЗУ = ${ram} ГБ`);

    launcher.removeAllListeners('debug');
    launcher.removeAllListeners('data');
    launcher.removeAllListeners('progress');
    launcher.removeAllListeners('close');

    launcher.on('debug', (e) => logToClient('debug', e));
    launcher.on('data', (e) => logToClient('game', e));

    launcher.on('progress', (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launch-progress', progress);
      }
    });

    launcher.on('close', (code) => {
      logToClient('info', `Процесс Minecraft завершился с кодом: ${code}`);
      unlockLauncher();
    });

    await launcher.launch(opts);

  } catch (err) {
    logToClient('error', `Ошибка подготовки к запуску: ${err.message}`);
    unlockLauncher();
  }
});