import { spawn } from "node:child_process";
import electron from "electron";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const vite = spawn(npm, ["run", "dev", "--", "--host", "127.0.0.1"], { stdio: "inherit" });
let desktop;

const stop = () => {
  desktop?.kill();
  vite.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => {
  if (!desktop) process.exit(code ?? 1);
});

for (let attempt = 0; attempt < 120; attempt += 1) {
  try {
    const response = await fetch("http://127.0.0.1:5173", { signal: AbortSignal.timeout(500) });
    if (response.ok) break;
  } catch {
    if (attempt === 119) {
      stop();
      throw new Error("Vite 开发服务器未能在 60 秒内启动");
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

desktop = spawn(electron, ["."], { stdio: "inherit" });
desktop.on("exit", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
