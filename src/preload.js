/**
 * Electron Preload Script: UMGST Core
 * Blocking: Canvas Rendering & WASD/Space/Arrow Inputs
 */

const { contextBridge, ipcRenderer } = require("electron");

let APP_NAME = "{App Name}";

ipcRenderer.invoke("get-app-name").then((name) => {
  if (name) APP_NAME = name;
});

// Check for mc_jwt cookie on startup
const checkAuth = async () => {
  const result = await ipcRenderer.invoke("check-auth-cookie");
  if (result && result.success) {
    // Redirect to Success.html
    // We use a relative path that Electron can resolve, or we can send another IPC to the main process
    // to load the file properly. Loading local files from a remote origin is usually blocked.
    ipcRenderer.send("load-success-page");
  }
};

checkAuth();

const blockInputs = (e) => {
  const blockedKeys = [
    "w",
    "a",
    "s",
    "d",
    "W",
    "A",
    "S",
    "D", // Movement
    " ",
    "E",
    "e",
    "Spacebar", //Action
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight", // Arrow Movement
  ];

  if (blockedKeys.includes(e.key)) {
    e.stopImmediatePropagation(); // Prevents the game engine from ever seeing the event
    e.preventDefault(); // Prevents default browser behavior (scrolling)
    return false;
  }
};
const applyPageOverrides = () => {
  // 0. Text Replacement "Welcome to Magic Garden" -> "Are you sure?"
  const textToFind = "Welcome to Magic Garden";
  const replacementText = "Are you sure?";
  const xpath = `//*[text()='${textToFind}']`;
  const matchingElement = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  ).singleNodeValue;
  if (matchingElement) {
    matchingElement.innerText = replacementText;
  }

  // 1. Target the specific container
  const container = document.querySelector(".McFlex.css-1rqntds");
  const outerContainer = document.querySelector(
    ".QuinoaUI-CenterArea.css-m8fi37",
  );

  if (
    container &&
    !document.getElementById("umgst-injected-flag") &&
    outerContainer
  ) {
    // Apply the requested CSS to the container
    container.style.flexDirection = "column";
    outerContainer.style.cssText = `

      display: flex;
      justify-content: center; /* Centers horizontally (main-axis) */
      align-items: center;     /* Centers vertically (cross-axis) */
      height: 100vh;           /* Ensures the container has a height to center against (adjust as needed) */
      width: max-content;

      `;
    // Create a wrapper to mark injection so we don't repeat it
    const wrapper = document.createElement("div");
    wrapper.id = "umgst-injected-flag";
    wrapper.style.display = "contents";

    // HTML for the prompt
    const promptPara = document.createElement("p");
    promptPara.style.cssText = `    font-size: 16px;
    font-weight: var(--chakra-fontWeights-bold);
    line-height: 1.25;
                      font-size: 18px;`;
    promptPara.innerText = `Would you like to Sign into ${APP_NAME} using the Unofficial Magic Garden Sign-in Tool?`;

    // HTML for the warning
    const warningPara = document.createElement("p");
    warningPara.style.cssText = `
      padding: 10px;
                  max-width: 80vh;
                  align-self: center;
                  text-align: center;
                  background: black;
                  color: white; /* Added for readability on black background */
                  border-radius: 25px;
                  margin-top: 15px;
                  font-size: 14px;
                  opacity: 0.85;
                  line-height: 1.4;
        `;
    warningPara.innerText = `⚠️WARNING, THIS IS NOT AN OFFICIAL APP AND ${APP_NAME} WILL HAVE ACCESS TO YOUR MAGIC GARDEN AUTH TOKEN. (it will be able to log in as u!)⚠️`;

    // Append to the container
    wrapper.appendChild(promptPara);
    wrapper.appendChild(warningPara);
    container.prepend(wrapper);

    console.log("[UMGST] UI Elements Injected.");
  }

  // 2. Nuke Canvases
  document.querySelectorAll("canvas").forEach((canvas) => {
    canvas.remove();
  });

  const bottomBars = document.getElementsByClassName("QuinoaUI-BottomBar");

  if (bottomBars.length > 0) {
    bottomBars[0].remove();
  }
};

const startUMGST = () => {
  // Block Keyboard
  window.addEventListener("keydown", blockInputs, true);
  window.addEventListener("keyup", blockInputs, true);

  // Watch for DOM changes
  const observer = new MutationObserver(() => {
    applyPageOverrides();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

// Initialization check
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startUMGST);
} else {
  startUMGST();
}
window.addEventListener("DOMContentLoaded", () => {
  // Check if the current URL matches the error state
  if (
    window.location.href.includes(
      "https://magicgarden.gg/oauth2/redirect?error=access_denied",
    )
  ) {
    // 1. Wipe the existing HTML
    document.documentElement.innerHTML = `
      <head>
        <title>Access Denied</title>
        <style>
          body {
            background-color: #121212;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          h1 { margin-bottom: 24px; font-weight: 500; }
          button {
            background-color: #5865F2;
            color: white;
            border: none;
            padding: 12px 28px;
            border-radius: 4px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
          }
          button:hover { background-color: #4752c4; }
          .titlebar {
            height: 40px;
            background: #2b3035;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            app-region: drag;
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 10000000000; /* Ensure it's on top of other elements */
            font-family: Arial, serif;
          }
        </style>
      </head>
      <body>
        <div class="titlebar"></div>
        <h1>Access Denied, Retry?</h1>
        <button id="retry-button">Retry Login</button>
      </body>
    `;

    // 2. Add the redirect logic
    const button = document.getElementById("retry-button");
    if (button) {
      button.addEventListener("click", () => {
        window.location.href = "https://magicgarden.gg/";
      });
    }
  }
});

window.addEventListener("DOMContentLoaded", () => {
  localStorage.setItem("isAmbienceMuteAtom", "true");
  localStorage.setItem("isMusicMuteAtom", "true");
  localStorage.setItem("musicVolumeAtom", "0");
  localStorage.setItem("ambienceVolumeAtom", "0");
  localStorage.setItem("soundEffectsVolumeAtom", "0.005");

  const styles = `
    #umgst-status {
        position: fixed;
        top: 0; left: 0; width: 100%;
        background: #ff0055; color: white;
        text-align: center; font-weight: bold;
        z-index: 2147483647; padding: 5px;
        font-family: sans-serif;
    }
    .css-1mtlufb {
    display: none;
    }
    .McFlex.css-1rvqre5 {
    display: none;
    }
    .chakra-button.css-3ryuu8 {
    display: none;
    }
    .chakra-button.css-1w5l2io {
    display: none;
    }
    .McFlex.css-19voh6a {
    display: none !important;
    }
    .chakra-button.css-1rjriuz {
    display: none;
    }
    .chakra-text.css-14go5ty {
    display: none;
    }
    #preloading-spinner {
    display: none;
    }
    `;
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
});

window.addEventListener("DOMContentLoaded", async () => {
  // Check if the current URL contains 'discord'
  if (window.location.href.includes("discord")) {
    // 1. Create and inject the CSS
    const style = document.createElement("style");
    style.textContent = `
      .titlebar {
        height: 40px;
        background: #2b3035;
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        -webkit-app-region: drag; /* Electron specific for draggable areas */
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 10000000000;
        font-family: Arial, sans-serif;
      }

      /* Shift the Discord app down so it's not covered by the bar */
      body {
        margin-top: 40px !important;
      }
    `;
    document.head.appendChild(style);

    // 2. Create the Toolbar element
    const toolbar = document.createElement("div");
    toolbar.className = "titlebar";

    // 3. Add to the DOM
    document.body.prepend(toolbar);
  }

  // Handle Success.html
  if (window.location.href.includes("Success.html")) {
    const code = await ipcRenderer.invoke("get-auth-code");
    const container = document.querySelector(".container");
    if (container && code) {
      const codePara = document.createElement("p");
      codePara.style.cssText = `
        font-size: 32px;
        font-weight: bold;
        color: #fc4eb8;
        letter-spacing: 5px;
        margin: 20px 0;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
      `;
      codePara.innerText = code;
      
      const instructions = document.createElement("p");
      instructions.innerText = "Please enter this code in the application to complete sign-in.";
      
      container.appendChild(codePara);
      container.appendChild(instructions);
    }
  }
});
