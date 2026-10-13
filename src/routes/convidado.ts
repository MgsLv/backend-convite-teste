import { Router } from "express";
import { checkGuestInvitation, registerGuest } from "../services/guests.js";
import { delay } from "../test-hooks.js";
import { bodyToken, lookupLimiter, queryText, requestContext, send } from "./http.js";

export const convidadoRouter: Router = Router();

convidadoRouter.get("/", lookupLimiter(), async (req, res) => {
  const token = queryText(req.query.convite);

  await delay(token);
  send(res, await checkGuestInvitation(token, queryText(req.query.request)));
});

convidadoRouter.post("/", async (req, res) => {
  await delay(bodyToken(req.body));
  send(res, await registerGuest(req.body, requestContext(req)));
});
