const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { execFile } = require('child_process');
const tar = require('tar');
const AdmZip = require('adm-zip');

/**
 * Определяет необходимую версию Java по версии Minecraft
 */
function getRecommendedJavaVersion(mcVersion) {
  if (!mcVersion) return 21;
  const match = String(mcVersion).trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return 21;

  const minor = parseInt(match[2], 10);
  const patch = match[3] ? parseInt(match[3], 10) : 0;

  if (minor < 17) {
    return 8; // Minecraft 1.7.x - 1.16.5
  }
  if (minor === 17) {
    return 17; // Minecraft 1.17.x стабильно работает на Java 17
  }
  if (minor >= 18 && minor <= 20) {
    if (minor === 20 && patch >= 5) {
      return 21; // 1.20.5+ перешел на Java 21
    }
    return 17; // Minecraft 1.18.x - 1.20.4
  }
  return 21; // Minecraft 1.21+
}

/**
 * Проверяет запуск бинарника Java и возвращает строку версии
 */
function verifyJavaBinary(javaPath) {
  return new Promise((resolve) => {
    execFile(javaPath, ['-version'], { timeout: 7000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ valid: false, error: error.message });
      } else {
        const out = (stderr || stdout || '').trim().split('\n')[0];
        resolve({ valid: true, versionString: out });
      }
    });
  });
}

/**
 * Ищет исполняемый файл Java в каталоге
 */
function findJavaExecutable(dir, executableName) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findJavaExecutable(fullPath, executableName);
      if (found) return found;
    } else if (entry.name.toLowerCase() === executableName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Проверяет наличие Java нужной версии и скачивает её при необходимости
 */
async function ensureJava(rootDir, javaVersion = 21, logCallback = console.log) {
  const javaDir = path.join(rootDir, 'runtime', `java-${javaVersion}`);
  const isWin = process.platform === 'win32';
  const executableName = isWin ? 'javaw.exe' : 'java';

  let javaPath = findJavaExecutable(javaDir, executableName);

  if (javaPath && fs.existsSync(javaPath)) {
    if (!isWin) {
      try { fs.chmodSync(javaPath, 0o755); } catch (_) {}
    }
    const check = await verifyJavaBinary(javaPath);
    if (check.valid) {
      logCallback('info', `[JavaManager] Найдена готовая Java ${javaVersion}: ${javaPath} (${check.versionString})`);
      return javaPath;
    }
    logCallback('warn', `[JavaManager] Локальная среда Java повреждена (${check.error}). Переустановка...`);
    fs.rmSync(javaDir, { recursive: true, force: true });
  }

  logCallback('info', `[JavaManager] Скачивание JRE ${javaVersion} для платформы ${process.platform} (${process.arch})...`);
  fs.mkdirSync(javaDir, { recursive: true });

  const platform = isWin ? 'windows' : (process.platform === 'darwin' ? 'mac' : 'linux');
  let arch = 'x64';
  if (process.arch === 'arm64') arch = 'aarch64';
  else if (process.arch === 'ia32' || process.arch === 'x86') arch = 'x86';

  const archiveExt = isWin ? 'zip' : 'tar.gz';
  const jreUrl = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/${platform}/${arch}/jre/hotspot/normal/eclipse?project=jdk`;
  const jdkFallbackUrl = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/${platform}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;

  const tempArchivePath = path.join(os.tmpdir(), `apiary-java-${javaVersion}-${Date.now()}.${archiveExt}`);

  try {
    try {
      await downloadFile(jreUrl, tempArchivePath, (progress) => {
        logCallback('info', `[JavaManager] Скачивание JRE ${javaVersion}: ${progress}%`);
      });
    } catch (err) {
      logCallback('warn', `[JavaManager] JRE недоступен (${err.message}). Пробуем загрузить JDK...`);
      await downloadFile(jdkFallbackUrl, tempArchivePath, (progress) => {
        logCallback('info', `[JavaManager] Скачивание JDK ${javaVersion}: ${progress}%`);
      });
    }

    logCallback('info', `[JavaManager] Распаковка архива Java...`);

    if (isWin) {
      const zip = new AdmZip(tempArchivePath);
      zip.extractAllTo(javaDir, true);
    } else {
      await tar.x({ file: tempArchivePath, cwd: javaDir });
    }
  } finally {
    if (fs.existsSync(tempArchivePath)) {
      try { fs.unlinkSync(tempArchivePath); } catch (_) {}
    }
  }

  javaPath = findJavaExecutable(javaDir, executableName);

  if (!javaPath) {
    throw new Error(`Не удалось найти ${executableName} после распаковки Java ${javaVersion}!`);
  }

  if (!isWin) {
    try { fs.chmodSync(javaPath, 0o755); } catch (_) {}
  }

  const finalCheck = await verifyJavaBinary(javaPath);
  if (!finalCheck.valid) {
    throw new Error(`Установленный бинарник Java не запускается: ${finalCheck.error}`);
  }

  logCallback('info', `[JavaManager] Java ${javaVersion} успешно установлена: ${finalCheck.versionString}`);
  return javaPath;
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'Apiary-Launcher' } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return request(response.headers.location);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP status ${response.statusCode}`));
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
        fileStream.on('finish', () => fileStream.close(resolve));
        fileStream.on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
      }).on('error', reject);
    };

    request(url);
  });
}

module.exports = {
  ensureJava,
  getRecommendedJavaVersion,
  verifyJavaBinary
};