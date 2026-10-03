import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, join } from "node:path";
import { parse } from "dotenv";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = resolve(root, "frontend/dist");
const privateName = /SERVICE_ROLE|SECRET|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|PASSWORD|SMTP_PASS|ACCESS_TOKEN/i;
const values = new Set();
for (const env of [process.env, ...await Promise.all([
  ".env", ".env.local", ".env.production", "backend/.env", "frontend/.env", "frontend/.env.local", "frontend/.env.production",
].map(async file => {
  try { return parse(await readFile(resolve(root, file))); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}))]) {
  for (const [name, value] of Object.entries(env)) {
    if (privateName.test(name) && value?.length >= 8) {
      if (name.startsWith("VITE_")) throw new Error("A VITE_ variable contains a private credential. Remove it before building.");
      values.add(value);
    }
  }
}
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|css|html|json|map)$/.test(entry.name)) {
      const content = await readFile(file, "utf8");
      const recognizableSecret = /sb_secret_[\w-]{16,}|postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
      if ([...values].some(value => content.includes(value)) || recognizableSecret.test(content))
        throw new Error(`Private credential detected in ${relative(root, file)}. Secret value withheld.`);
    }
  }
}
await scan(output);
console.log(`PASS frontend bundle scan: ${values.size} configured private values checked; recognizable secret patterns absent.`);
