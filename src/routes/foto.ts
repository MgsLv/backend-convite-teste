import { Router } from "express";
import { uploadPhoto } from "../services/photos.js";
import { delay } from "../test-hooks.js";
import { bodyToken, send } from "./http.js";

export const fotoRouter: Router = Router();

fotoRouter.post("/", async (req, res) => {
  await delay(bodyToken(req.body));
  send(res, await uploadPhoto(req.body));
});
