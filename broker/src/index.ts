import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "vaultbreaker-broker", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Broker] Service running on port ${PORT}`);
});
