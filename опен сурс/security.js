const { safeStorage } = require('electron');

/**
 * Зашифровать чувствительный токен или строку в base64
 * @param {string} plainText
 * @returns {string}
 */
function encryptToken(plainText) {
  if (!plainText) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plainText);
      return buffer.toString('base64');
    }
  } catch (err) {
    console.error('[Security] Ошибка шифрования токена:', err);
  }
  // Резервный fallback (Base64), если системное шифрование недоступно
  return Buffer.from(plainText, 'utf-8').toString('base64');
}

/**
 * Расшифровать base64-строку обратно в исходный токен
 * @param {string} encryptedBase64
 * @returns {string}
 */
function decryptToken(encryptedBase64) {
  if (!encryptedBase64) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    }
  } catch (err) {
    console.error('[Security] Ошибка расшифровки токена:', err);
  }
  return Buffer.from(encryptedBase64, 'base64').toString('utf-8');
}

module.exports = {
  encryptToken,
  decryptToken
};