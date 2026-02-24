const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { exec } = require("child_process");

// Path to the JWT file
let userDataPath;
if (process.platform === "win32") {
  userDataPath = path.join(process.env.APPDATA, "umgst");
} else if (process.platform === "darwin") {
  userDataPath = path.join(
    process.env.HOME,
    "Library",
    "Application Support",
    "umgst",
  );
} else {
  userDataPath = path.join(process.env.HOME, ".config", "umgst");
}

const filePath = path.join(userDataPath, "mc_jwt.json");

function decrypt(encryptedContent, ivHex, code) {
  const algorithm = "aes-256-ctr";
  const key = crypto.createHash("sha256").update(String(code)).digest();
  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(Buffer.from(encryptedContent, "hex"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

function openUmgst(appName) {
  const url = `umgst://${appName}`;
  console.log(`Launching UMGST via ${url}...`);

  let command;
  switch (process.platform) {
    case "win32":
      command = `start ${url}`;
      break;
    case "darwin":
      command = `open ${url}`;
      break;
    default:
      command = `xdg-open ${url}`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`Failed to open app: ${error.message}`);
      console.log("Please manually launch UMGST if it didn't open.");
    }
  });
}

// 1. Launch the App
openUmgst("NodeExample");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 2. Ask for the code
console.log("\nWaiting for user login...");
rl.question(
  "Please enter the 6-digit code shown in the UMGST app: ",
  (code) => {
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(fileContent);

        if (data.mc_jwt && data.iv) {
          console.log("Found encrypted JWT.");

          try {
            const jwt = decrypt(data.mc_jwt, data.iv, code.trim());
            console.log("Decrypted JWT:", jwt);
            // Now you can use this JWT to authenticate with Magic Garden APIs
          } catch (err) {
            console.error("Failed to decrypt. Incorrect code?");
          }
        } else {
          console.log("Invalid file format or missing data.");
        }
      } else {
        console.log(
          `JWT file not found at ${filePath}. Please log in via UMGST first.`,
        );
      }
    } catch (error) {
      console.error("Error:", error);
    }
    rl.close();
  },
);
