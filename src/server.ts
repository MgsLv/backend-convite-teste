import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { autocadastroRouter } from "./routes/autocadastro.js";
import { convidadoRouter } from "./routes/convidado.js";
import { conviteRouter } from "./routes/convite.js";
import { fotoRouter } from "./routes/foto.js";
import { stateRouter } from "./routes/state.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(helmet());
app.use(
  cors({
    origin: config.allowedOrigins,
    allowedHeaders: ["Content-Type", "Ambiente"],
  }),
);
app.use(express.json({ limit: "10mb" })); // base64 de foto
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

app.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

app.use("/convite", conviteRouter);
app.use("/foto", fotoRouter);
app.use("/autocadastro", autocadastroRouter);
app.use("/convidado", convidadoRouter);

// estado do banco de teste: nunca existe fora de teste
if (config.testHooks) app.use("/state", stateRouter);

// 404 genérico
app.use((_req, res) => {
  res.status(404).json({ RES: false, MSG: "Rota não encontrada." });
});

// erro genérico: nunca devolve nem registra body, foto ou CPF
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status;

  // corpo inválido (JSON quebrado, grande demais): erro do cliente, não do servidor
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ RES: false, MSG: "Requisição inválida." });
    return;
  }

  console.error(`Erro em ${req.method} ${req.path}:`, (err as Error).message);
  res.status(500).json({ RES: false, MSG: "Erro interno." });
});

app.listen(config.port, config.host, () => {
  console.log(`Backend de teste em http://${config.host}:${config.port}`);
});

// O túnel (devtunnels) encaminha para "localhost", que no Windows costuma resolver para ::1 (IPv6).
// Escuta também no loopback IPv6, que continua inacessível de fora da máquina.
if (config.host === "127.0.0.1") {
  app.listen(config.port, "::1").on("error", (error) => {
    console.warn(`Sem escuta em ::1 (${error.message}): túneis que usam IPv6 vão responder 502.`);
  });
}
