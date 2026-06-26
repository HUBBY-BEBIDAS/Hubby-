/**
 * Gera chaves RSA-2048 para assinar JWTs com RS256 e uma ENCRYPTION_KEY aleatória.
 *
 * Uso:
 *   node scripts/generate-keys.mjs
 *
 * Cole a saída no seu .env (nunca commite o .env).
 */

import { generateKeyPairSync, randomBytes } from "crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const encryptionKey = randomBytes(32).toString("hex");

// Converte PEM para uma única linha escapando quebras de linha
const toEnvPem = (pem) => pem.replace(/\n/g, "\\n");

console.log("# Cole as variáveis abaixo no seu .env\n");
console.log(`NEXTAUTH_PRIVATE_KEY="${toEnvPem(privateKey)}"`);
console.log(`NEXTAUTH_PUBLIC_KEY="${toEnvPem(publicKey)}"`);
console.log(`ENCRYPTION_KEY="${encryptionKey}"`);
