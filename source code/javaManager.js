const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const tar = require('tar');
const AdmZip = require('adm-zip');

/**
 * Проверяет наличие Java нужной версии и скачивает её при необходимости.
 */
async function ensureJava(rootDir, javaVersion = 21, logCallback = console.log) {
  const javaDir = path.join(rootDir, 'runtime', `java-${javaVersion}`);
  const isWin = process.platform === 'win32';
  const executableName = isWin ? 'javaw.exe' : 'java';
  
  const findJavaExecutable = (dir) => {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        const found = findJavaExecutable(fullPath);
        if (found) return found;
      } else if (file.name.toLowerCase() === executableName) {
        return fullPath;
      }
    }
    return null;
  };

  let javaPath = findJavaExecutable(javaDir);

  if (javaPath && fs.existsSync(javaPath)) {
    logCallback('info', `[JavaManager] Найдена локальная Java ${javaVersion}: ${javaPath}`);
    return javaPath;
  }

  logCallback('info', `[JavaManager] Java ${javaVersion} не найдена. Начинаем скачивание...`);

  fs.mkdirSync(javaDir, { recursive: true });

  const platform = isWin ? 'windows' : (process.platform === 'darwin' ? 'mac' : 'linux');
  const arch = process.arch === 'x64' ? 'x64' : 'x86';
  const archiveExt = isWin ? 'zip' : 'tar.gz';
  
  const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/${platform}/${arch}/jre/hotspot/normal/eclipse?project=jdk`;

  // Сохраняем архив во системную временную папку, чтобы он не лежал внутри javaDir
  const tempArchivePath = path.join(os.tmpdir(), `java-runtime-${Date.now()}.${archiveExt}`);

  try {
    await downloadFile(downloadUrl, tempArchivePath, (progress) => {
      logCallback('info', `[JavaManager] Скачивание Java ${javaVersion}: ${progress}%`);
    });

    logCallback('info', `[JavaManager] Распаковка Java...`);

    if (isWin) {
      const zip = new AdmZip(tempArchivePath);
      zip.extractAllTo(javaDir, true);
    } else {
      await tar.x({
        file: tempArchivePath,
        cwd: javaDir
      });
    }
  } finally {
    // Гарантированно удаляем временный архив
    if (fs.existsSync(tempArchivePath)) {
      fs.unlinkSync(tempArchivePath);
    }
  }

  javaPath = findJavaExecutable(javaDir);

  if (!javaPath) {
    throw new Error(`Не удалось найти ${executableName} после распаковки Java!`);
  }

  logCallback('info', `[JavaManager] Java ${javaVersion} успешно установлена: ${javaPath}`);
  return javaPath;
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      const options = {
        headers: {
          'User-Agent': 'Apiary-Launcher'
        }
      };

      https.get(currentUrl, options, (response) => {
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

module.exports = { ensureJava };