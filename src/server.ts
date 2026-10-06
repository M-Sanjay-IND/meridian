import dotenv from "dotenv";
import { buildApp } from "./app.js";

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

const app = buildApp();

async function start() {
  try {
    await app.listen({ port, host });
    console.log(`[Meridian] Server listening at http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
