# UMGST - Unofficial Magic Garden Sign-in Tool

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-lightgrey)

**UMGST** is a ~secure helper application designed to bridge the gap between unofficial applications and **Magic Garden** game authentication. It simplifies the OAuth flow, and provides a standardized way for your apps to log in users.

---

## ✨ Features

*   **Secure Authentication**: Captures the Magic Garden session cookie and encrypts the JWT token.
*   **Multi-Factor Verification**: Uses a generated **6-digit code** displayed in-app that the user must manually enter into your application, preventing unauthorized background access.
*   **Custom Protocol Support**: Launch the tool directly from your app or website using `umgst://<AppName>`.
*   **Auto-Cleanup**: Automatically wipes sensitive cookies from the session immediately after capture.

---

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Umm12many/umgst.git
    cd umgst
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the app**:
    ```bash
    npm start
    ```

4.  **Package (Optional)**:
    To create an executable for your OS:
    ```bash
    npm run make
    ```

---

## 🛠️ Developer Integration

### 1. Launching UMGST
You can trigger UMGST from any application or website using the custom protocol scheme. Append your application's name to customize the user experience.

**Protocol:** `umgst://<YourAppName>`

> **Example:**
> Launching `umgst://SuperGame` will display:
> *"Would you like to Sign into SuperGame using the Unofficial Magic Garden Sign in Application?"*

### 2. The Authentication Flow
1.  **Launch**: Your app opens `umgst://YourApp`.
2.  **User Action**: The user logs in via the UMGST window.
3.  **Success**: UMGST displays a **6-digit code** (e.g., `123456`) and saves the *encrypted* token to disk.
4.  **Verification**: Your app prompts the user to enter this code.
5.  **Decryption**: Your app reads the file, uses the code to derive the key, and decrypts the JWT.

### 3. File Location
The encrypted token is saved to `mc_jwt.json` in the user's data directory:

*   **Windows**: `%APPDATA%\umgst\mc_jwt.json`
*   **macOS**: `~/Library/Application Support/umgst/mc_jwt.json`
*   **Linux**: `~/.config/umgst/mc_jwt.json`

**File Format:**
```json
{
  "mc_jwt": "encrypted_hex_string",
  "iv": "initialization_vector_hex"
}
```

### 4. Decryption Logic
*   **Algorithm**: AES-256-CTR
*   **Key**: SHA-256 hash of the 6-digit code string.
*   **IV**: Provided in the JSON file.

### 5. Verification & Cleanup (Crucial Security Step)
After successfully decrypting the token, your application **MUST** verify the session by calling the UMGST protocol again with the code:

`umgst://verified/<the_6_digit_code>`

**Why?**
1.  **Confirmation**: This tells UMGST that your app successfully decrypted the token.
2.  **Cleanup**: UMGST will immediately **delete the `mc_jwt.json` file** from disk to prevent unauthorized access.
3.  **UI Feedback**: UMGST will update its UI to "Authentication Successful!".

---

## 📂 Examples

We provide ready-to-use examples for different environments in the `examples/` directory:

### 🟢 Node.js
**Location:** `examples/nodejs/auth_example.js`
A complete script that:
1.  Launches UMGST automatically.
2.  Prompts the user for the code in the terminal.
3.  Reads and decrypts the token using standard crypto libraries.
4.  **Verifies the session** by calling `umgst://verified/<code>`, triggering the cleanup.

### 🟣 C# (.NET)
**Location:** `examples/csharp/`
A full `.NET 8.0` console application that:
1.  Implements the `umgst://` protocol launch.
2.  Includes a custom `AES-256-CTR` implementation (compatible with Node.js).
3.  Demonstrates secure file reading and decryption.
4.  *(Note: You should add the `umgst://verified/<code>` call to complete the flow in production).*

### 🌐 HTML / Web
**Location:** `examples/html/index.html`
A simple web page demonstrating how to trigger the `umgst://` protocol from a browser button.
*Note: Web apps cannot read local files directly. You would typically use this to launch the auth flow and then have the user paste the code/token into your web interface.*

---

## ⚠️ Disclaimer

This is an **unofficial** tool and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Magic Circle or its Developers. Use at your own risk.
