import { Router } from "express";
import { getState, resetState } from "../services/test-state.js";

/** Só é montado com TEST_HOOKS=true (ver server.ts). */
export const stateRouter: Router = Router();

stateRouter.get("/", async (_req, res) => {
  res.json(await getState());
});

stateRouter.delete("/", async (_req, res) => {
  await resetState();
  res.json({ RES: true });
});
