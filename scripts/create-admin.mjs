// Creates the first admin account (or resets an admin's password).
//
//   npm run admin:create
//
// You type the email and password yourself; the password is hidden while you
// type and is stored only as a bcrypt hash. Nothing is printed or logged.
//
// For automated setups (CI, containers) you can instead set ADMIN_EMAIL and
// ADMIN_PASSWORD in the environment.
import readline from "node:readline";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { dbConfig } from "./env.mjs";

let passwordProblem;
try {
  ({ passwordProblem } = await import("../src/lib/password-policy.ts"));
} catch {
  console.error("This script needs Node.js 22.18 or newer (it reuses the TypeScript password rules).");
  console.error(`You are running Node ${process.version}.`);
  process.exit(1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

/** Reads a line without echoing it. */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("A password cannot be typed here. Run this in a normal terminal, or set ADMIN_EMAIL and ADMIN_PASSWORD."));
      return;
    }
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") { // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

const cfg = dbConfig();
const fromEnv = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

let email = (process.env.ADMIN_EMAIL || "").toLowerCase();
let password = process.env.ADMIN_PASSWORD || "";
let name = process.env.ADMIN_NAME || "";

if (!fromEnv) {
  console.log("\nCreate an admin account for the Yasmeen World dashboard.\n");
  email = (await ask("Email: ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("That does not look like an email address.");
    process.exit(1);
  }
  name = await ask("Your name (optional): ");
  console.log("\nPassword rules: at least 10 characters, with letters and numbers.");
  password = await askHidden("Password: ");
  const problem = passwordProblem(password, email);
  if (problem) {
    console.error(`\n${problem}`);
    process.exit(1);
  }
  const again = await askHidden("Repeat password: ");
  if (again !== password) {
    console.error("\nThe two passwords do not match.");
    process.exit(1);
  }
} else {
  const problem = passwordProblem(password, email);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
}

let conn;
try {
  conn = await mysql.createConnection({ ...cfg, charset: "utf8mb4" });
} catch (err) {
  console.error(`\nCould not connect to the database "${cfg.database}": ${err.message}`);
  console.error("Run  npm run db:setup  first, and make sure MySQL is running.");
  process.exit(1);
}

try {
  await conn.query("SET time_zone = '+00:00'");
  const hash = await bcrypt.hash(password, 12);
  const [rows] = await conn.query("SELECT id FROM admins WHERE email = ?", [email]);

  if (rows.length > 0) {
    if (!fromEnv) {
      const answer = (await ask(`\nAn admin with this email already exists. Set a new password for it? (y/N) `)).toLowerCase();
      if (answer !== "y" && answer !== "yes") {
        console.log("Nothing changed.");
        process.exit(0);
      }
    }
    await conn.query("UPDATE admins SET password_hash = ?, is_active = 1 WHERE id = ?", [hash, rows[0].id]);
    await conn.query("DELETE FROM admin_sessions WHERE admin_id = ?", [rows[0].id]); // sign out everywhere
    await conn.query("DELETE FROM login_attempts WHERE email = ?", [email]); // clear any lock-out
    console.log(`\nPassword updated for ${email}. All existing sessions were signed out.`);
  } else {
    await conn.query("INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)", [email, name, hash]);
    console.log(`\nAdmin account created for ${email}.`);
  }
  console.log("Sign in at  /admin/login");
} finally {
  await conn.end();
}
