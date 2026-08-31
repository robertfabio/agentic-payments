import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { listar } from "./log.js";

export const auditRouter: Router = Router();

auditRouter.get("/auditoria", requireAuth, (req, res) => {
  const bruto = Number(req.query.limite);
  const limite = Number.isFinite(bruto) ? Math.min(Math.max(bruto, 1), 200) : 50;

  return res.json({ registros: listar(req.usuario!.id, limite) });
});
