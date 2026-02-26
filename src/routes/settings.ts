import { Router } from "express";
import { prisma } from "../db/client";

const router = Router();

// GET /api/settings
router.get("/", async (_req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(settings);
  } catch (err) {
    console.error("List settings error:", err);
    res.status(500).json({ error: "Failed to list settings" });
  }
});

// PUT /api/settings/:key
router.put("/:key", async (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined) {
      res.status(400).json({ error: "value is required" });
      return;
    }

    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value },
    });

    res.json(setting);
  } catch (err) {
    console.error("Update setting error:", err);
    res.status(500).json({ error: "Failed to update setting" });
  }
});

export default router;
