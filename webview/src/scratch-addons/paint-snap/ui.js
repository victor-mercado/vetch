import { setSnapFrom, setSnapTo, snapOn, snapFrom, snapTo, toggle, threshold, setThreshold } from "./state.js";

/** @type {import("../../addon-api/content-script/typedef").UserscriptUtilities} */
export function initUI({ addon, msg }) {
  const createGroup = () => {
    const el = document.createElement("div");
    el.className = "sa-paint-snap-group";
    return el;
  };

  const createButton = ({ useButtonTag } = {}) => {
    const el = document.createElement(useButtonTag ? "button" : "span");
    el.className = "sa-paint-snap-button";
    el.setAttribute("role", "button");
    return el;
  };

  const controlsGroup = createGroup();
  addon.tab.displayNoneWhileDisabled(controlsGroup);

  const toggleButton = createButton();

  const magnetIcon = document.createElement("span");
  magnetIcon.textContent = "🧲";
  magnetIcon.style.fontSize = "1rem";
  magnetIcon.style.userSelect = "none";
  magnetIcon.style.display = "flex";
  magnetIcon.style.alignItems = "center";
  magnetIcon.style.justifyContent = "center";
  magnetIcon.style.width = "100%";
  magnetIcon.style.height = "100%";

  toggleButton.addEventListener("click", () => {
    if (!snapOn) {
      if (!Object.values(snapTo).some((e) => e)) {
        setSnapTo("pageCenter", true);
      }
      if (!Object.values(snapFrom).some((e) => e)) {
        setSnapFrom("boxCenter", true);
      }
    }
    toggle(!snapOn);
    toggleButton.dataset.enabled = snapOn;
    magnetIcon.style.opacity = snapOn ? "1" : "0.4";
    magnetIcon.style.filter = snapOn ? "none" : "grayscale(100%)";
  });
  toggleButton.title = msg("toggle") || "Toggle Snapping";

  magnetIcon.style.opacity = snapOn ? "1" : "0.4";
  magnetIcon.style.filter = snapOn ? "none" : "grayscale(100%)";

  toggleButton.appendChild(magnetIcon);
  toggleButton.dataset.enabled = snapOn;
  controlsGroup.appendChild(toggleButton);

  const controlsLoop = async () => {
    let hasRunOnce = false;
    while (true) {
      const canvasControls = await addon.tab.waitForElement("[class*='paint-editor_canvas-controls_']", {
        markAsSeen: true,
        reduxEvents: [
          "scratch-gui/navigation/ACTIVATE_TAB",
          "scratch-gui/mode/SET_PLAYER",
          "fontsLoaded/SET_FONTS_LOADED",
          "scratch-gui/locales/SELECT_LOCALE",
          "scratch-gui/targets/UPDATE_TARGET_LIST",
        ],
        reduxCondition: (state) =>
          state.scratchGui.editorTab.activeTabIndex === 1 && !state.scratchGui.mode.isPlayerOnly,
      });
      const zoomControlsContainer = canvasControls.querySelector("[class*='paint-editor_zoom-controls_']");
      if (!zoomControlsContainer) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      addon.tab.appendToSharedSpace({
        space: "paintEditorZoomControls",
        element: controlsGroup,
        order: 2,
      });

      if (!hasRunOnce) {
        hasRunOnce = true;
        const groupClass = zoomControlsContainer.firstChild?.className || "";
        const buttonClass = zoomControlsContainer.firstChild?.firstChild?.className || "";
        for (const el of document.querySelectorAll(".sa-paint-snap-group")) {
          el.className += " " + groupClass;
        }
        for (const el of document.querySelectorAll(".sa-paint-snap-button")) {
          el.className += " " + buttonClass;
        }
      }

      await new Promise(r => setTimeout(r, 2000));
    }
  };
  controlsLoop();
}
