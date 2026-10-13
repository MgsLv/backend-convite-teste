import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  HOST: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_MIGRATE_USER: z.string().min(1),
  DB_MIGRATE_PASSWORD: z.string().min(1),
  ALLOWED_ORIGINS: z.string().min(1),
  FRONT_ORIGIN: z.string().url(),
  STORAGE_DIR: z.string().min(1),
  TEST_HOOKS: z.enum(["true", "false"]).default("false"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // só os nomes das variáveis, nunca os valores
  const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
  console.error("Configuração inválida. Verifique o .env:", names.join(", "));
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    migrateUser: env.DB_MIGRATE_USER,
    migratePassword: env.DB_MIGRATE_PASSWORD,
  },
  // o navegador envia a origem sem barra final: "https://x.ms/" nunca bateria
  allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
  frontOrigin: env.FRONT_ORIGIN,
  storageDir: env.STORAGE_DIR,
  // hooks de teste nunca ligam em produção
  testHooks: env.TEST_HOOKS === "true" && env.NODE_ENV !== "production",
} as const;
