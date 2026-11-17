import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import { parse } from "dotenv";

const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const staged = process.argv.includes("--staged");
const files = git(
  staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
)
  .split("\0")
  .filter(Boolean);
const secretFile = (path) =>
  /^\.env(?:\.|$)/i.test(basename(path)) ||
  /\.env(?:\.|$)/i.test(basename(path)) ||
  /\.(?:pem|key|p12|pfx)$/i.test(path) ||
  /(?:^|\/)(?:credentials[^/]*|service-account[^/]*)\.json$/i.test(path);
const binary = (path) =>
  /\.(?:jpg|jpeg|png|gif|webp|ico|woff2?|ttf|pdf)$/i.test(path);
const knownValues = new Set();
for (const name of await readdir(".")) {
  if (!/^\.env(?:\.|$)/i.test(name)) continue;
  const values = parse(await readFile(name));
  for (const [key, value] of Object.entries(values))
    if (
      /(?:SECRET|TOKEN|PASSWORD|MONGODB_URI|PRIVATE_KEY)$/.test(key) &&
      value.length >= 16 &&
      !/^(?:your_|replace_|example)/i.test(value)
    )
      knownValues.add(value);
}
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\brzp_live_[A-Za-z0-9]{10,}\b/,
  /mongodb(?:\+srv)?:\/\/[^\s/'"]+:[^\s@'"/]+@/i,
  /\bAC[0-9a-f]{32}\b/i,
];
const problems = new Set();
function inspect(path, text) {
  if (secretFile(path)) problems.add(`${path}: private configuration file`);
  if (patterns.some((pattern) => pattern.test(text)))
    problems.add(`${path}: possible embedded credential`);
  if ([...knownValues].some((value) => text.includes(value)))
    problems.add(`${path}: contains a private value from local configuration`);
}
for (const path of new Set(files)) {
  if (secretFile(path)) problems.add(`${path}: private configuration file`);
  if (binary(path)) continue;
  const text = staged
    ? git(["show", `:${path}`])
    : await readFile(path, "utf8");
  inspect(path, text);
}
if (process.argv.includes("--history")) {
  for (const line of git(["rev-list", "--objects", "--all"]).split("\n")) {
    const space = line.indexOf(" ");
    if (space < 0) continue;
    const oid = line.slice(0, space),
      path = line.slice(space + 1);
    if (secretFile(path)) problems.add(`${path}: private file in Git history`);
    if (binary(path) || git(["cat-file", "-t", oid]).trim() !== "blob")
      continue;
    inspect(path, git(["cat-file", "blob", oid]));
  }
}
if (process.argv.includes("--client")) {
  async function scanDirectory(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) await scanDirectory(next);
      else if ([".js", ".json", ".map"].includes(extname(next))) {
        const text = await readFile(next, "utf8");
        if ([...knownValues].some((value) => text.includes(value)))
          problems.add(
            `${next}: private configuration value in browser output`,
          );
      }
    }
  }
  await scanDirectory(".next/static");
}
if (problems.size) {
  console.error("Secret checks failed. Values are redacted:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else
  console.info(
    `Secret checks passed for ${new Set(files).size} files${staged ? " in the index" : ""}${process.argv.includes("--history") ? ", Git history" : ""}${process.argv.includes("--client") ? ", and browser build output" : ""}. No environment files are allowed.`,
  );
