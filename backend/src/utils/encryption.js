const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
}

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
    if (!text) return null;
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt sensitive data
 */
function decrypt(ciphertext) {
    if (!ciphertext) return null;

    let result = ciphertext;
    let attempts = 0;

    // Recursive Decryption Loop:
    // If the result starts with 'U2Fsd' (Salted__ base64), it implies another layer of encryption.
    // We loop to peel back layers (e.g. Trigger Encrypt + Manual Encrypt).
    // We stop if it looks like a JWT (eyJ) or if we hit the limit.
    while (result && typeof result === 'string' && result.startsWith('U2Fsd') && attempts < 5) {
        attempts++;
        try {
            const bytes = CryptoJS.AES.decrypt(result, ENCRYPTION_KEY);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);

            if (decrypted && decrypted.length > 0) {
                result = decrypted;
            } else {
                // If decryption fails/returns empty (wrong key or bad data), stop and return last good state (or original)
                // But usually bytes.toString() is empty on failure.
                break;
            }
        } catch (e) {
            console.error(`[EncryptionUtil] Decrypt attempt ${attempts} failed:`, e.message);
            break;
        }
    }

    return result;
}

module.exports = {
    encrypt,
    decrypt
};
