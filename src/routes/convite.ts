import { Router } from "express";
import { checkInvitation } from "../services/invitations.js";
import { delay } from "../test-hooks.js";
import { lookupLimiter, queryText, send } from "./http.js";

export const conviteRouter: Router = Router();

conviteRouter.get("/", lookupLimiter(), async (req, res) => {
  const token = queryText(req.query.convite);

  await delay(token);
  send(res, await checkInvitation(token, queryText(req.query.request)));
});
