const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow;
let appName = "External App"; // Default app name
let latestAuthCode = null; // Store the code in memory

// Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("umgst", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("umgst");
}

// Parse App Name from URL
function parseAppName(argv) {
  const protocolPrefix = "umgst://";
  const urlArg = argv.find((arg) => arg.startsWith(protocolPrefix));
  if (urlArg) {
    const rawName = urlArg.substring(protocolPrefix.length);
    // Remove trailing slash if present
    appName = rawName.endsWith("/") ? rawName.slice(0, -1) : rawName;
    appName = decodeURIComponent(appName); // Handle URL encoding
  }
}

// Force Single Instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    parseAppName(commandLine);
  });

  // Handle initial launch
  parseAppName(process.argv);
}

// Handle macOS open-url
app.on("open-url", (event, url) => {
  event.preventDefault();
  const protocolPrefix = "umgst://";
  if (url.startsWith(protocolPrefix)) {
    const rawName = url.substring(protocolPrefix.length);
    appName = rawName.endsWith("/") ? rawName.slice(0, -1) : rawName;
    appName = decodeURIComponent(appName);
  }
});

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Recommended for security
    },
    titleBarOverlay: {
      color: "#2b3035",
      symbolColor: "#fc4eb8",
      height: 40,
    },
    titleBarStyle: "hidden",
  });

  // and load the index.html of the app.
  mainWindow.loadURL("https://magicgarden.gg", {
    userAgent: "McDesktopClient",
  });

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

function encrypt(text, code) {
  const algorithm = "aes-256-ctr";
  // Create a 32-byte key from the 6-digit code (simple hash)
  const key = crypto.createHash("sha256").update(String(code)).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return {
    iv: iv.toString("hex"),
    content: encrypted.toString("hex"),
  };
}

async function captureCookie(cookie) {
  try {
    const jwtValue = cookie.value;
    const userDataPath = app.getPath("userData");
    const filePath = path.join(userDataPath, "mc_jwt.json");

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    latestAuthCode = code; // Store code in memory

    // Encrypt the JWT
    const encryptedData = encrypt(jwtValue, code);

    const data = JSON.stringify(
      {
        mc_jwt: encryptedData.content,
        iv: encryptedData.iv,
        // code: code, // Code is no longer saved to file
      },
      null,
      2
    );

    fs.writeFileSync(filePath, data);
    console.log(`[UMGST] Cookie captured and saved to ${filePath}`);

    // Wipe the cookie
    const url = `http${cookie.secure ? "s" : ""}://${cookie.domain.startsWith(".") ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`;
    await session.defaultSession.cookies.remove(url, "mc_jwt");
    console.log(`[UMGST] Cookie wiped from ${url}`);
    return true;
  } catch (error) {
    console.error("[UMGST] Error capturing cookie:", error);
    return false;
  }
}

// IPC Handler to check for mc_jwt cookie
ipcMain.handle("check-auth-cookie", async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      name: "mc_jwt",
    });

    if (cookies.length > 0) {
      const success = await captureCookie(cookies[0]);
      return { success };
    }
  } catch (error) {
    console.error("[UMGST] Error checking for cookie:", error);
  }
  return { success: false };
});

ipcMain.handle("get-app-name", () => {
  return appName;
});

ipcMain.handle("get-auth-code", () => {
  return latestAuthCode;
});

ipcMain.on("load-success-page", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.loadFile(path.join(__dirname, "Success.html"));
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Listen for cookie changes as a backup/proactive measure
  session.defaultSession.cookies.on(
    "changed",
    async (event, cookie, cause, removed) => {
      if (cookie.name === "mc_jwt" && !removed) {
        const success = await captureCookie(cookie);
        if (success && mainWindow) {
          mainWindow.loadFile(path.join(__dirname, "Success.html"));
        }
      }
    }
  );

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
