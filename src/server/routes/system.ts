import { Hono } from "hono";
import { spawn } from "child_process";

export const systemRouter = new Hono();

// POST /api/system/select-directory - Open native directory picker dialog
systemRouter.post("/select-directory", async (c) => {
  const platform = process.platform;

  try {
    let selectedPath: string | null = null;

    if (platform === "darwin") {
      // macOS: Use osascript (AppleScript)
      selectedPath = await selectDirectoryMacOS();
    } else if (platform === "linux") {
      // Linux: Try zenity first, then kdialog
      selectedPath = await selectDirectoryLinux();
    } else if (platform === "win32") {
      // Windows: Use PowerShell
      selectedPath = await selectDirectoryWindows();
    } else {
      return c.json({ error: "Unsupported platform", code: "UNSUPPORTED_PLATFORM" }, 400);
    }

    if (!selectedPath) {
      return c.json({ cancelled: true, path: null });
    }

    return c.json({ cancelled: false, path: selectedPath });
  } catch (error) {
    console.error("Failed to open directory picker:", error);
    return c.json({ error: "Failed to open directory picker", code: "DIALOG_ERROR" }, 500);
  }
});

function selectDirectoryMacOS(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const script = `
      set selectedFolder to choose folder with prompt "プロジェクトフォルダを選択してください"
      return POSIX path of selectedFolder
    `;

    const proc = spawn("osascript", ["-e", script]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Remove trailing newline and slash
        const path = stdout.trim().replace(/\/$/, "");
        resolve(path);
      } else if (code === 1 && stderr.includes("User canceled")) {
        // User cancelled the dialog
        resolve(null);
      } else if (stderr.includes("User canceled") || stderr.includes("(-128)")) {
        resolve(null);
      } else {
        reject(new Error(`osascript exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", reject);
  });
}

function selectDirectoryLinux(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // Try zenity first
    const zenity = spawn("zenity", ["--file-selection", "--directory", "--title=プロジェクトフォルダを選択してください"]);
    let stdout = "";
    let stderr = "";

    zenity.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    zenity.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    zenity.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else if (code === 1) {
        // User cancelled
        resolve(null);
      } else {
        // zenity not available, try kdialog
        tryKdialog(resolve, reject);
      }
    });

    zenity.on("error", () => {
      // zenity not available, try kdialog
      tryKdialog(resolve, reject);
    });
  });
}

function tryKdialog(resolve: (value: string | null) => void, reject: (reason?: unknown) => void) {
  const kdialog = spawn("kdialog", ["--getexistingdirectory", ".", "--title", "プロジェクトフォルダを選択してください"]);
  let stdout = "";

  kdialog.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  kdialog.on("close", (code) => {
    if (code === 0) {
      resolve(stdout.trim());
    } else if (code === 1) {
      resolve(null);
    } else {
      reject(new Error("No dialog tool available (zenity or kdialog)"));
    }
  });

  kdialog.on("error", () => {
    reject(new Error("No dialog tool available (zenity or kdialog)"));
  });
}

function selectDirectoryWindows(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = "プロジェクトフォルダを選択してください"
      $dialog.ShowNewFolderButton = $true
      $result = $dialog.ShowDialog()
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dialog.SelectedPath
      }
    `;

    const proc = spawn("powershell", ["-NoProfile", "-Command", script]);
    let stdout = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });

    proc.on("error", reject);
  });
}
