import { spawn, type IPty } from "bun-pty";

interface PtySession {
  pty: IPty;
  sessionId: string;
  worktreePath: string;
  outputBuffer: string;
  dataListeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number) => void>;
}

const MAX_OUTPUT_BUFFER = 64 * 1024; // 64KB

class PtyManager {
  private sessions: Map<string, PtySession> = new Map();

  async createSession(
    sessionId: string,
    worktreePath: string,
    cols: number = 80,
    rows: number = 24,
  ): Promise<PtySession> {
    // Check if session already exists
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const shell = process.env.SHELL || "/bin/bash";

    const pty = spawn(shell, ["-l"], {
      name: "xterm-256color",
      cwd: worktreePath,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      } as Record<string, string>,
      cols,
      rows,
    });

    const session: PtySession = {
      pty,
      sessionId,
      worktreePath,
      outputBuffer: "",
      dataListeners: new Set(),
      exitListeners: new Set(),
    };

    // Handle output
    pty.onData((data) => {
      // Append to buffer (ring buffer style)
      session.outputBuffer += data;
      if (session.outputBuffer.length > MAX_OUTPUT_BUFFER) {
        session.outputBuffer = session.outputBuffer.slice(-MAX_OUTPUT_BUFFER);
      }

      // Notify listeners
      for (const listener of session.dataListeners) {
        listener(data);
      }
    });

    // Handle exit
    pty.onExit(({ exitCode }) => {
      for (const listener of session.exitListeners) {
        listener(exitCode);
      }
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }

  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.write(data);
    return true;
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.resize(cols, rows);
    return true;
  }

  kill(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  onData(sessionId: string, listener: (data: string) => void): () => void {
    const session = this.sessions.get(sessionId);
    if (!session) return () => {};
    session.dataListeners.add(listener);
    return () => session.dataListeners.delete(listener);
  }

  onExit(sessionId: string, listener: (code: number) => void): () => void {
    const session = this.sessions.get(sessionId);
    if (!session) return () => {};
    session.exitListeners.add(listener);
    return () => session.exitListeners.delete(listener);
  }

  getOutputBuffer(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    return session?.outputBuffer || "";
  }

  getPid(sessionId: string): number | undefined {
    const session = this.sessions.get(sessionId);
    return session?.pty.pid;
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  // Mark all sessions as stopped on server restart
  cleanup(): void {
    for (const [_sessionId, session] of this.sessions) {
      try {
        session.pty.kill();
      } catch {
        // Ignore
      }
    }
    this.sessions.clear();
  }
}

export const ptyManager = new PtyManager();
