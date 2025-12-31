import { spawn } from "bun-pty";

const pty = await spawn("/bin/bash", ["-i"], {
  cwd: process.cwd(),
  env: process.env as Record<string, string>,
  cols: 80,
  rows: 24,
});

console.log("PTY spawned, pid:", pty.pid);

// Read output
pty.onData((data) => {
  console.log("data:", data);
});

// Write input
pty.write("echo 'Hello from bun-pty!'\n");
pty.write("exit\n");

// Wait for exit
pty.onExit((code) => {
  console.log("Process exited with code:", code);
});

// Keep process alive
await new Promise((resolve) => setTimeout(resolve, 2000));
