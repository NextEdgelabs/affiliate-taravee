import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * AES-256-GCM encryption for secrets at rest (the Shopify Admin API token).
 * Key comes from SHOPIFY_TOKEN_ENC_KEY (base64 of 32 bytes). In production a
 * missing/invalid key is fatal; in dev we fall back to a fixed insecure key.
 */
@Injectable()
export class TokenCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>("SHOPIFY_TOKEN_ENC_KEY");
    const isProd = config.get<string>("NODE_ENV") === "production";

    if (!raw) {
      if (isProd) {
        throw new Error("SHOPIFY_TOKEN_ENC_KEY is required in production");
      }
      this.key = Buffer.alloc(32, "dev-only-insecure-taravee-key-32");
      return;
    }

    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error("SHOPIFY_TOKEN_ENC_KEY must be base64-encoded 32 bytes");
    }
    this.key = buf;
  }

  encrypt(plaintext: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      ciphertext: enc.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}
