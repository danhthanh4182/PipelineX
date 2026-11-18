// PipelineX channels: one checkout per channel, all from this repository. A channel's kind (its "type") is chosen once,
// when it is created: its industry/ folder (sources, categories, prompts, channel.json) comes from packs/<type>/ (or
// this checkout's own industry/ for type "ai"), and it gets its own branch, database, ports and editor token. Keys are
// shared: the channel's .env.shared links to this checkout's .env, and its own .env (loaded after) overrides the rest.
//
//   npm run channel -- create <name> --type <type> [--title "Channel Name"]
//   npm run channel -- list | status
//   npm run channel -- start <name> | stop <name>
//   npm run channel -- update [<name>]      merge this branch's code into the channel(s), install, migrate
//   npm run channel -- remove <name> --yes  stop it and delete its checkout, branch and database (cannot be undone)
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { userInfo } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHANNELS = path.resolve(ROOT, "../../channels");
const REGISTRY = path.join(CHANNELS, "channels.json");
const NODE_BIN = path.dirname(process.execPath);

interface Channel { name: string; type: string; title: string; dir: string; branch: string; webPort: number; apiPort: number; database: string; createdAt: string }

const registry = (): Channel[] => (existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, "utf8")) : []);
const save = (list: Channel[]) => { mkdirSync(CHANNELS, { recursive: true }); writeFileSync(REGISTRY, JSON.stringify(list, null, 2) + "\n"); };
const find = (name: string) => registry().find((c) => c.name === name) ?? die(`No channel "${name}". See: npm run channel -- list`);
function die(message: string): never { console.error(message); process.exit(1); }
const run = (cmd: string, args: string[], cwd = ROOT, extraEnv: Record<string, string> = {}) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}`, ...extraEnv } });
const out = (cmd: string, args: string[], cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();
const arg = (flag: string) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };

/** Where a type's pack lives: packs/<type>/, or this checkout's own industry/ for the AI channel it started as. */
function packDir(type: string): string {
  if (type === "ai") return path.join(ROOT, "industry");
  const dir = path.join(ROOT, "packs", type);
  if (!existsSync(path.join(dir, "channel.json"))) die(`No pack for type "${type}" (packs/${type}/channel.json). Available: ${packTypes().join(", ")}`);
  return dir;
}
const packTypes = () => ["ai", ...(existsSync(path.join(ROOT, "packs")) ? readdirSync(path.join(ROOT, "packs")).filter((d) => existsSync(path.join(ROOT, "packs", d, "channel.json"))) : [])];

const portFree = (port: number) => new Promise<boolean>((resolve) => {
  const socket = createConnection({ port, host: "127.0.0.1" });
  socket.once("connect", () => { socket.destroy(); resolve(false); });
  socket.once("error", () => resolve(true));
});

async function create(name: string, type: string, title?: string) {
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(name)) die("A channel name is 2-31 lowercase letters, digits or dashes, starting with a letter.");
  if (registry().some((c) => c.name === name)) die(`Channel "${name}" already exists.`);
  const pack = packDir(type);
  // A channel starts from the last commit: changes not committed yet (yours or another agent's) are not in it.
  if (out("git", ["status", "--porcelain", "--untracked-files=no"])) console.log("Note: this checkout has uncommitted changes; the new channel starts from the last commit without them.");
  const branch = `channel/${name}`;
  const dir = path.join(CHANNELS, name);
  const database = `pipelinex_${name.replace(/-/g, "_")}`;
  const used = registry().flatMap((c) => [c.webPort, c.apiPort]);
  let webPort = 3010;
  while (used.includes(webPort) || !(await portFree(webPort)) || !(await portFree(webPort + 1))) webPort += 10;

  console.log(`Creating channel "${name}" (type ${type}) in ${dir} on ports ${webPort}/${webPort + 1}…`);
  run("git", ["worktree", "add", "-b", branch, dir, "HEAD"]);
  if (type !== "ai") {
    // The channel's industry/ is the pack (package.json and tsconfig stay the engine's).
    for (const entry of readdirSync(path.join(dir, "industry"))) if (!["package.json", "tsconfig.json"].includes(entry)) rmSync(path.join(dir, "industry", entry), { recursive: true });
    for (const entry of readdirSync(pack)) if (entry !== "site") cpSync(path.join(pack, entry), path.join(dir, "industry", entry), { recursive: true });
    if (existsSync(path.join(pack, "site"))) cpSync(path.join(pack, "site"), path.join(dir, "site"), { recursive: true });
  }
  const channelFile = path.join(dir, "industry", "channel.json");
  const profile = JSON.parse(readFileSync(channelFile, "utf8"));
  if (title) { profile.brand.name = title; writeFileSync(channelFile, JSON.stringify(profile, null, 2) + "\n"); }
  // Later code updates never overwrite the channel's own pack and site.
  writeFileSync(path.join(dir, ".gitattributes"), "industry/** merge=ours\nsite/site.ts merge=ours\n");
  run("git", ["config", "merge.ours.driver", "true"], dir);
  run("git", ["add", "-A"], dir);
  run("git", ["commit", "-q", "-m", `Channel ${name}: ${type} pack`], dir);

  symlinkSync(path.join(ROOT, ".env"), path.join(dir, ".env.shared"));
  writeFileSync(path.join(dir, ".env"), [
    `# Channel "${name}" (${type}). Loaded after .env.shared (this repository's main .env, with the keys): these win.`,
    `DATABASE_URL=postgres://${userInfo().username}@127.0.0.1:5432/${database}`,
    `API_PORT=${webPort + 1}`, `API_BASE_URL=http://127.0.0.1:${webPort + 1}`, `SITE_URL=http://localhost:${webPort}`,
    "COLLECT_ENABLED=true", "VIDEO_AUTO_ENABLED=false",
    `VIDEO_RENDERER_DIR=${path.join(ROOT, "renderer")}`,
    `VIDEO_EDITOR_TOKEN=${randomBytes(24).toString("hex")}`, "",
  ].join("\n"));

  try { run("createdb", [database]); } catch { console.log(`(database ${database} already exists)`); }
  run("npm", ["install", "--no-audit", "--no-fund"], dir);
  run(process.execPath, ["--env-file=.env.shared", "--env-file=.env", "scripts/migrate.ts"], dir);
  run(process.execPath, ["--env-file=.env.shared", "--env-file=.env", "scripts/seed.ts"], dir);

  save([...registry(), { name, type, title: profile.brand.name, dir, branch, webPort, apiPort: webPort + 1, database, createdAt: new Date().toISOString() }]);
  console.log(`\nChannel "${name}" is ready. Start it: npm run channel -- start ${name}`);
  console.log(`Admin: http://localhost:${webPort}/admin/videos   Editor MCP: http://127.0.0.1:${webPort + 1}/api/admin/video/mcp (token in ${path.join(dir, ".env")})`);
}

const logDir = (c: Channel) => path.join(c.dir, ".data", "logs");
const pidFile = (c: Channel) => path.join(c.dir, ".data", "channel.pids");

function start(c: Channel) {
  mkdirSync(logDir(c), { recursive: true });
  const env = { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}`, PORT: String(c.webPort), API_BASE_URL: `http://127.0.0.1:${c.apiPort}` };
  const launch = (role: string, cmd: string, args: string[], cwd: string) => {
    const log = path.join(logDir(c), `${role}.log`);
    const child = spawn("/bin/sh", ["-c", `exec ${[cmd, ...args].map((a) => `'${a}'`).join(" ")} >> '${log}' 2>&1`], { cwd, env, detached: true, stdio: "ignore" });
    child.unref();
    return `${role}=${child.pid}`;
  };
  const envFiles = ["--env-file-if-exists=../../.env.shared", "--env-file-if-exists=../../.env"];
  const pids = [
    launch("api", process.execPath, [...envFiles, "src/main.ts"], path.join(c.dir, "apps/api")),
    launch("worker", process.execPath, [...envFiles, "src/main.ts"], path.join(c.dir, "apps/worker")),
    launch("web", path.join(c.dir, "node_modules/.bin/react-router"), ["dev", "--port", String(c.webPort), "--host", "127.0.0.1"], path.join(c.dir, "apps/web")),
  ];
  writeFileSync(pidFile(c), pids.join("\n") + "\n");
  console.log(`Started ${c.name}: web http://localhost:${c.webPort}, api ${c.apiPort}. Logs: ${logDir(c)}`);
}

function stop(c: Channel) {
  if (!existsSync(pidFile(c))) return console.log(`${c.name} is not running (no pid file).`);
  for (const line of readFileSync(pidFile(c), "utf8").split("\n").filter(Boolean)) {
    const pid = Number(line.split("=")[1]);
    try { process.kill(-pid, "SIGTERM"); } catch { try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ } }
  }
  rmSync(pidFile(c));
  console.log(`Stopped ${c.name}.`);
}

async function status() {
  const list = registry();
  if (!list.length) return console.log("No channels yet. Create one: npm run channel -- create <name> --type <type>");
  for (const c of list) {
    const up = !(await portFree(c.apiPort)), web = !(await portFree(c.webPort));
    console.log(`${c.name.padEnd(16)} ${c.type.padEnd(10)} ${c.title.padEnd(24)} web :${c.webPort} ${web ? "up" : "down"}  api :${c.apiPort} ${up ? "up" : "down"}  ${c.dir}`);
  }
}

function update(only?: string) {
  const branch = out("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  for (const c of registry().filter((x) => !only || x.name === only)) {
    console.log(`\n== ${c.name}: merging ${branch}`);
    run("git", ["merge", "--no-edit", branch], c.dir);
    run("npm", ["install", "--no-audit", "--no-fund"], c.dir);
    run(process.execPath, ["--env-file=.env.shared", "--env-file=.env", "scripts/migrate.ts"], c.dir);
  }
  console.log("\nRestart running channels to load the new code: npm run channel -- stop <name> && npm run channel -- start <name>");
}

/** Deletes a channel for good: its checkout, branch, database and registry entry (only with --yes). */
function remove(c: Channel) {
  if (!process.argv.includes("--yes")) die(`This deletes ${c.dir}, branch ${c.branch} and database ${c.database} for good. Add --yes to confirm.`);
  if (existsSync(pidFile(c))) stop(c);
  run("git", ["worktree", "remove", "--force", c.dir]);
  run("git", ["branch", "-D", c.branch]);
  try { run("dropdb", [c.database]); } catch { console.log(`(database ${c.database} was not there)`); }
  save(registry().filter((x) => x.name !== c.name));
  console.log(`Removed channel ${c.name}.`);
}

const [command, name] = [process.argv[2], process.argv[3]];
switch (command) {
  case "create": await create(name ?? die("Name the channel."), arg("--type") ?? die(`Give its type: --type ${packTypes().join("|")}`), arg("--title")); break;
  case "list": case "status": await status(); break;
  case "start": start(find(name ?? die("Name the channel."))); break;
  case "stop": stop(find(name ?? die("Name the channel."))); break;
  case "update": update(name); break;
  case "remove": remove(find(name ?? die("Name the channel."))); break;
  case "types": console.log(packTypes().join("\n")); break;
  default: console.log("npm run channel -- create <name> --type <type> [--title T] | list | start <name> | stop <name> | update [<name>] | remove <name> --yes | types");
}
