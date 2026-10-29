import { setSnapFrom, setSnapTo, snapOn, snapFrom, snapTo, toggle, threshold, setThreshold } from "./state.js";
import snapOnIcon from "../../icons/snap-on.svg";
import snapOffIcon from "../../icons/snap-off.svg";
import canvasDarkIcon from "../../icons/canvas-dark.svg";
import canvasLightIcon from "../../icons/canvas-light.svg";

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

  const createIcon = () => {
    const el = document.createElement("img");
    el.draggable = false;
    el.style.width = "1.25rem";
    el.style.height = "1.25rem";
    el.style.verticalAlign = "middle";
    el.style.userSelect = "none";
    return el;
  };

  const toggleButton = createButton();
  const darkModeButton = createButton();

  const magnetIcon = createIcon();
  const updateMagnetIcon = () => {
    magnetIcon.src = snapOn ? snapOnIcon : snapOffIcon;
    toggleButton.setAttribute("aria-pressed", String(snapOn));
  };

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
    updateMagnetIcon();
  });
  toggleButton.title = "Toggle Snapping";

  updateMagnetIcon();

  toggleButton.appendChild(magnetIcon);
  toggleButton.dataset.enabled = snapOn;
  controlsGroup.appendChild(toggleButton);

  let isDarkMode = typeof window !== 'undefined' && window.vetchSettings?.isDarkMode !== undefined ? window.vetchSettings.isDarkMode : false;
  let bgRect = null;
  const moonIcon = createIcon();
  const updateMoonIcon = () => {
    moonIcon.src = isDarkMode ? canvasLightIcon : canvasDarkIcon;
    darkModeButton.setAttribute("aria-pressed", String(isDarkMode));
  };
  updateMoonIcon();

  const applyDarkMode = () => {
    if (bgRect) {
      bgRect.remove();
      bgRect = null;
    }

    if (isDarkMode && window.paper && window.paper.project) {
      const bgLayer = window.paper.project.layers.find(l => l.data && l.data.isBackgroundGuideLayer);

      bgRect = new window.paper.Path.Rectangle({
        point: [-10000, -10000],
        size: [20000, 20000],
        fillColor: new window.paper.Color(0, 0, 0, 0.6),
        locked: true,
        guide: true,
        data: { isHelperItem: true, noSelect: true, noHover: true }
      });

      if (bgLayer) {
        bgLayer.addChild(bgRect);
        bgRect.bringToFront();
      } else {
        window.paper.project.activeLayer.addChild(bgRect);
        bgRect.sendToBack();
      }
    }
  };

  darkModeButton.addEventListener("click", () => {
    isDarkMode = !isDarkMode;
    if (typeof window !== 'undefined' && window.vscode) {
      window.vscode.postMessage({ type: 'saveSetting', setting: 'isDarkMode', value: isDarkMode });
    }
    updateMoonIcon();
    applyDarkMode();
  });

  darkModeButton.title = "Toggle Canvas Background";
  darkModeButton.appendChild(moonIcon);
  controlsGroup.appendChild(darkModeButton);

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
        if (isDarkMode) applyDarkMode();
      }

      await new Promise(r => setTimeout(r, 2000));
    }
  };
  controlsLoop();
}
