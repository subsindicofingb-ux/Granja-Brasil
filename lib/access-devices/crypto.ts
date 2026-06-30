import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT = "granja-access-device-v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.ACCESS_DEVICE_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error(
      "ACCESS_DEVICE_ENCRYPTION_KEY não configurada. Defina a variável no servidor.",
    );
  }

  return scryptSync(secret, SALT, 32);
}

export function encryptAccessDevicePassword(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptAccessDevicePassword(cipherText: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(cipherText, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isAccessDeviceEncryptionConfigured(): boolean {
  return Boolean(process.env.ACCESS_DEVICE_ENCRYPTION_KEY?.trim());
}
