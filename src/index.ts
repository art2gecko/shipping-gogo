import express from "express";
import authRouter from "./routes/auth";
import documentsRouter from "./routes/documents";
import labelsRouter from "./routes/labels";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Raw body parsing for label uploads (binary PDF/PNG)
app.use("/api/labels", express.raw({ type: ["application/pdf", "image/png"], limit: "10mb" }));
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/labels", labelsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Fulfillment Orchestrator listening on :${PORT}`);
});

export default app;
