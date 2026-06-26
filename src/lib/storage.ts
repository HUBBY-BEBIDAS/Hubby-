import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Retorna true se as variáveis de ambiente do storage estão configuradas.
 * Quando false, o sistema usa fallback base64 local (apenas desenvolvimento).
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_BUCKET &&
    process.env.STORAGE_KEY &&
    process.env.STORAGE_SECRET
  );
}

function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.STORAGE_REGION ?? "auto",
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.STORAGE_KEY!,
      secretAccessKey: process.env.STORAGE_SECRET!,
    },
    // Cloudflare R2 e MinIO requerem path-style
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  });
}

const BUCKET = () => process.env.STORAGE_BUCKET!;

const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type PresignedUploadResult = {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
};

/**
 * Gera uma URL assinada para o frontend fazer PUT direto no bucket.
 * Expira em 5 minutos (tempo para o upload ocorrer).
 * A URL de acesso tem expiração de 15 minutos — gerada separadamente.
 */
export async function getLogoUploadUrl(
  distributorId: string,
  mimeType: string
): Promise<PresignedUploadResult> {
  if (!ALLOWED_LOGO_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Tipo de arquivo não permitido. Use: ${[...ALLOWED_LOGO_MIME_TYPES].join(", ")}`
    );
  }

  const ext = mimeType.split("/")[1].replace("svg+xml", "svg");
  const key = `distributors/${distributorId}/logo.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    ContentType: mimeType,
    // Metadado informativo — não impede uploads maiores no lado do bucket
    Metadata: { "max-size": String(MAX_LOGO_SIZE_BYTES) },
  });

  const s3 = createS3Client();
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return { uploadUrl, key, expiresInSeconds: 300 };
}

/**
 * Gera uma URL assinada de leitura com expiração de 15 minutos.
 * Chamar a cada renderização que exiba a logo.
 */
export async function getLogoSignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: key,
  });

  const s3 = createS3Client();
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutos
}

/**
 * Remove a logo anterior do bucket ao substituir.
 */
export async function deleteLogo(key: string): Promise<void> {
  const s3 = createS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}
