async function generateKey() {
    return self.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

async function storeKey(key) {
    const exportedKey = await self.crypto.subtle.exportKey("jwk", key);
    chrome.storage.local.set({ encryptionKey: exportedKey });
}

async function getKey() {
    const result = await chrome.storage.local.get('encryptionKey');
    if (result.encryptionKey) {
        return self.crypto.subtle.importKey(
            "jwk",
            result.encryptionKey,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
        );
    } else {
        // Generate a new key if not found
        const newKey = await generateKey();
        await storeKey(newKey);
        return newKey;
    }
}

async function encryptData(plaintext) {

    const key = await getKey();
    if (!key) {
        throw new Error('Encryption key not found.');
    }
    const encoded = new TextEncoder().encode(plaintext);
    const iv = self.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await self.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoded
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
}

async function decryptData(encryptedData) {
    const key = await getKey();
    if (!key) {
        throw new Error('Encryption key not found.');
    }
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);
    const decrypted = await self.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
    );

    return new TextDecoder().decode(decrypted);
}

async function storeEncryptedData(dataKey, data) {
    const encryptedData = await encryptData(JSON.stringify(data));
    chrome.storage.local.set({ [dataKey]: encryptedData });
}


async function retrieveDecryptedData(dataKey) {
    try {
        const result = await chrome.storage.local.get(dataKey);
        if (result[dataKey]) {
            const decryptedData = await decryptData(result[dataKey]);
            return JSON.parse(decryptedData);
        }
        return null;
    } catch (error) {
        console.error('Error retrieving or decrypting data:', error);
        return null;
    }
}