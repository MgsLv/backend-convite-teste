import { Router } from "express";
import { selfRegister } from "../services/registrations.js";
import { delay } from "../test-hooks.js";
import { bodyToken, send } from "./http.js";

export const autocadastroRouter: Router = Router();

autocadastroRouter.post("/", async (req, res) => {
  await delay(bodyToken(req.body));
  send(res, await selfRegister(req.body));
});
