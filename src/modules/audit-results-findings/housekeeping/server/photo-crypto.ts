import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const magic = Buffer.from('ARFIMG01');
export function photoKey(value: string | undefined): Buffer {
    if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('Persistent 32-byte photo encryption key is required');
    return Buffer.from(value, 'hex');
}
export function encryptPhoto(bytes: Buffer, key: Buffer, identity: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(identity));
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptPhoto(bytes: Buffer, key: Buffer, identity: string): Buffer {
    if (bytes.length < 36 || !bytes.subarray(0, 8).equals(magic)) throw new Error('Invalid encrypted photo');
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(8, 20));
    cipher.setAAD(Buffer.from(identity));
    cipher.setAuthTag(bytes.subarray(20, 36));
    return Buffer.concat([cipher.update(bytes.subarray(36)), cipher.final()]);
}
