import { Router } from "express";
import { prisma } from "../db/client";
import { recordAudit } from "../db/operations";
import { AuditAction } from "@prisma/client";

const router = Router();

// GET /api/exceptions
router.get("/", async (req, res) => {
  try {
    const { type, resolved, channel } = req.query;

    const where: Record<string, unknown> = {};
    if (type && typeof type === "string") {
      where.type = type;
    }
    if (resolved === "false") {
      where.resolved = false;
    } else if (resolved === "true") {
      where.resolved = true;
    }
    if (channel && typeof channel === "string") {
      where.order = { channel };
    }

    const exceptions = await prisma.exception.findMany({
      where,
      include: {
        order: { select: { id: true, channel: true, externalOrderId: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json(exceptions);
  } catch (err) {
    console.error("List exceptions error:", err);
    res.status(500).json({ error: "Failed to list exceptions" });
  }
});

// POST /api/exceptions/:id/resolve
router.post("/:id/resolve", async (req, res) => {
  try {
    const { note } = req.body;

    const exception = await prisma.exception.update({
      where: { id: req.params.id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: note || "Manual resolution",
      },
    });

    await recordAudit({
      action: AuditAction.EXCEPTION_RESOLVED,
      detail: `Exception resolved: ${exception.type}${note ? ` - ${note}` : ""}`,
      orderId: exception.orderId ?? undefined,
    });

    res.json(exception);
  } catch (err) {
    console.error("Resolve exception error:", err);
    res.status(500).json({ error: "Failed to resolve exception" });
  }
});

export default router;
