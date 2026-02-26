import express from "express";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import ordersRouter from "./routes/orders";
import batchesRouter from "./routes/batches";
import exceptionsRouter from "./routes/exceptions";
import documentsRouter from "./routes/documents";
import labelsRouter from "./routes/labels";
import serialsRouter from "./routes/serials";
import auditLogsRouter from "./routes/auditLogs";
import settingsRouter from "./routes/settings";
import usersRouter from "./routes/users";
import jobsRouter from "./routes/jobs";
import integrationsRouter from "./routes/integrations";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Raw body parsing for label uploads (binary PDF/PNG)
app.use("/api/labels", express.raw({ type: ["application/pdf", "image/png"], limit: "10mb" }));
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/batches", batchesRouter);
app.use("/api/exceptions", exceptionsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/labels", labelsRouter);
app.use("/api/serials", serialsRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/users", usersRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/integrations", integrationsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Fulfillment Orchestrator listening on :${PORT}`);
});

export default app;
