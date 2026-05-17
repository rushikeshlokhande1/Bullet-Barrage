import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? "3001",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

await run(process.execPath, ["./build.mjs"]);

spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
  env,
  stdio: "inherit",
  shell: false,
});
