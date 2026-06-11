import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

if (!fs.existsSync(envPath)) process.exit(0);

let s = fs.readFileSync(envPath, "utf8");
if (!/DATABASE_URL=.*USER:.*PASSWORD/.test(s)) process.exit(0);

s = s.replace(/DATABASE_URL=.*/m, "DATABASE_URL=postgresql://postgres:replace_with_password@localhost:5432/streamdesk");
fs.writeFileSync(envPath, s);
console.log("DATABASE_URL обновлён. Замените replace_with_password на локальный пароль PostgreSQL.");
