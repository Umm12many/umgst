# Developing with UMGST

Welcome to the **Unofficial Magic Garden Sign-in Tool (UMGST)** developer guide! This document explains how to integrate your applications with UMGST to securely authenticate users.

## 🚀 Overview

UMGST acts as a secure bridge for authentication. Instead of handling OAuth or cookie extraction yourself, you delegate this task to UMGST.

**The Flow:**
1.  **Launch**: Your app opens UMGST via a custom protocol (`umgst://YourApp`).
2.  **Authenticate**: The user signs in within UMGST.
3.  **Capture**: UMGST captures the session, encrypts it, and displays a 6-digit verification code.
4.  **Verify**: Your app asks the user for this code.
5.  **Decrypt**: Your app uses the code to decrypt the session token stored on disk.
6.  **Confirm**: Your app signals success to UMGST (`umgst://verified/<code>`), which triggers cleanup.

---

## 🔗 Protocol Integration

UMGST registers the `umgst://` protocol scheme on the user's system. You can trigger this from any language or framework that can open a URL.

### Launching the Tool
To start the login flow, open the following URL:

```
umgst://<YourApplicationName>
```

*   Replace `<YourApplicationName>` with the name you want displayed to the user (e.g., `SuperGame`, `MyDashboard`).
*   **Example**: `umgst://SuperGame`
    *   *Result*: The user sees "Would you like to Sign into SuperGame...?"

### Verifying the Session (Crucial)
After you have successfully decrypted the token (see below), you **must** confirm the session to clean up the sensitive file.

```
umgst://verified/<The6DigitCode>
```

*   **Example**: `umgst://verified/123456`
    *   *Result*: UMGST deletes the temporary credential file and shows "Authentication Successful!".

---

## 🔐 File Storage & Encryption

When a user successfully logs in, UMGST saves the encrypted JWT token to a JSON file in the user's application data directory.

### File Location
*   **Windows**: `%APPDATA%\umgst\mc_jwt.json`
*   **macOS**: `~/Library/Application Support/umgst/mc_jwt.json`
*   **Linux**: `~/.config/umgst/mc_jwt.json`

### File Structure
```json
{
  "mc_jwt": "a1b2c3d4...", 
  "iv": "e5f6g7h8..."
}
```
*   `mc_jwt`: The encrypted JWT token (hex string).
*   `iv`: The initialization vector used for encryption (hex string).

### Encryption Details
*   **Algorithm**: `aes-256-ctr`
*   **Key**: SHA-256 hash of the **6-digit code** displayed in the app.
*   **IV**: Provided in the file.

---

## 💻 Node.js Integration Example

Here is a complete, copy-pasteable module for handling the entire flow in Node.js.

### Prerequisites
```bash
npm install open
# OR use child_process (built-in) as shown below
```

### `auth_manager.js`

```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const readline = require('readline');

class UmgstAuth {
    constructor(appName) {
        this.appName = appName;
        this.userDataPath = this._getUserDataPath();
        this.filePath = path.join(this.userDataPath, 'mc_jwt.json');
    }

    /**
     * Determines the path to the UMGST data directory based on OS.
     */
    _getUserDataPath() {
        if (process.platform === 'win32') {
            return path.join(process.env.APPDATA, 'umgst');
        } else if (process.platform === 'darwin') {
            return path.join(process.env.HOME, 'Library', 'Application Support', 'umgst');
        } else {
            return path.join(process.env.HOME, '.config', 'umgst');
        }
    }

    /**
     * Opens the UMGST application via custom protocol.
     * @param {string} command - App name or command (e.g., 'MyApp' or 'verified/123456')
     */
    launch(command) {
        const url = command.includes('://') ? command : `umgst://${command}`;
        console.log(`[Auth] Launching: ${url}`);
        
        let shellCommand;
        switch (process.platform) {
            case 'win32': shellCommand = `start ${url}`; break;
            case 'darwin': shellCommand = `open ${url}`; break;
            default: shellCommand = `xdg-open ${url}`; break;
        }

        exec(shellCommand, (error) => {
            if (error) console.error(`[Auth] Error launching app: ${error.message}`);
        });
    }

    /**
     * Decrypts the token using the user-provided code.
     * @param {string} code - The 6-digit code from the UI.
     * @returns {string|null} - The decrypted JWT or null if failed.
     */
    decryptToken(code) {
        if (!fs.existsSync(this.filePath)) {
            console.error('[Auth] Error: Credential file not found. Please login first.');
            return null;
        }

        try {
            const fileContent = fs.readFileSync(this.filePath, 'utf8');
            const data = JSON.parse(fileContent);

            if (!data.mc_jwt || !data.iv) throw new Error('Invalid file format');

            // Derive Key: SHA-256 hash of the code
            const key = crypto.createHash('sha256').update(String(code.trim())).digest();
            const iv = Buffer.from(data.iv, 'hex');
            
            // Decrypt: AES-256-CTR
            const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
            let decrypted = decipher.update(Buffer.from(data.mc_jwt, 'hex'));
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString();

        } catch (error) {
            console.error('[Auth] Decryption failed. Incorrect code?', error.message);
            return null;
        }
    }

    /**
     * Completes the auth flow by verifying and cleaning up.
     * @param {string} code 
     */
    confirmSession(code) {
        this.launch(`verified/${code.trim()}`);
    }
}

// --- Usage Example ---

// 1. Initialize
const auth = new UmgstAuth('MyCoolApp');

// 2. Start Login Flow
console.log("Starting login flow...");
auth.launch(auth.appName);

// 3. Prompt User for Code (Simulated here with readline)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('
👉 Enter the 6-digit code from UMGST: ', (code) => {
    // 4. Decrypt
    const jwt = auth.decryptToken(code);
    
    if (jwt) {
        console.log('
✅ Login Successful!');
        console.log('JWT:', jwt.substring(0, 20) + '...'); // logging partial token for safety
        
        // 5. Confirm & Cleanup
        auth.confirmSession(code);
    }
    
    rl.close();
});
```

---

## 🛠️ Contribution & Setup

If you want to modify UMGST itself:

1.  **Clone**: `git clone https://github.com/Umm12many/umgst.git`
2.  **Install**: `npm install`
3.  **Run**: `npm start`
4.  **Package**: `npm run make` (Generates installers in `out/`)

### Project Structure
*   `src/index.js`: Main process. Handles lifecycle, IPC, file encryption, and protocol events.
*   `src/preload.js`: Preload script. Handles UI DOM manipulation (React injection) and secure IPC bridging.
*   `src/SignIn.html` & `Success.html`: The UI pages.
