import { Router } from "express";
import { prisma } from "../db/client";

const router = Router();

// GET /api/audit-logs
router.get("/", async (req, res) => {
  try {
    const { limit } = req.query;

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit as string, 10) : 50,
    });

    res.json(logs);
  } catch (err) {
    console.error("List audit logs error:", err);
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

export default router;
