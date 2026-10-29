import { normalizeHex, getHexRegex } from "../shared/normalize-color.js";

export default async ({ addon, console, msg }) => {
  let prevEventHandler;
  // A complete 6-digit code, which is applied while typing (3-digit codes are applied on Enter/blur)
  const fullHexRegex = /^#?[0-9a-fA-F]{6}$/;
  // Which color menu is open: "fill", "stroke", or undefined
  const getOpenColorMenu = () => {
    const state = addon.tab.redux.state;
    if (state.scratchPaint.modals.fillColor) return "fill";
    if (state.scratchPaint.modals.strokeColor) return "stroke";
  };
  // The raw color being edited in the given menu (first or second gradient color)
  const getStateColor = (fillOrStroke) => {
    if (!fillOrStroke) return;
    const state = addon.tab.redux.state;
    const colorType = state.scratchPaint.fillMode.colorIndex;
    const primaryOrSecondary = ["primary", "secondary"][colorType];
    const color = state.scratchPaint.color[`${fillOrStroke}Color`][primaryOrSecondary];
    if (color === null || color === "scratch-paint/style-path/mixed") return;
    return color;
  };
  const getColor = (fillOrStroke) => {
    const color = getStateColor(fillOrStroke);
    // This value can be arbitrary - it can be HEX, RGB, etc.
    // Use tinycolor to convert them.
    return color === undefined ? undefined : tinycolor(color).toHexString();
  };
  // Apply a hex color through the open color picker (which updates the selection, the Fill/Outline
  // state and the picker's sliders), keeping the current opacity
  const setColor = (hex, fillOrStroke) => {
    if (!window.vetchColorPicker) return;
    const current = getStateColor(fillOrStroke);
    const color = tinycolor(normalizeHex(hex));
    if (current !== undefined) {
      // Already applied (e.g. the field's change event after the code was applied while typing)
      if (tinycolor(current).toHexString() === color.toHexString()) return;
      color.setAlpha(tinycolor(current).getAlpha());
    }
    window.vetchColorPicker.setColor(color.getAlpha() < 1 ? color.toRgbString() : color.toHexString());
  };
  const updateColor = (saColorPickerColor, saColorPickerText, fillOrStroke) => {
    const color = getColor(fillOrStroke);
    saColorPickerColor.value = color || "#000000";
    // Don't overwrite a code the user is in the middle of typing
    if (document.activeElement !== saColorPickerText) saColorPickerText.value = color || "";
  };
  while (true) {
    const element = await addon.tab.waitForElement('[class*="color-picker_swatch-row_"]', {
      markAsSeen: true,
      reduxCondition: (state) => state.scratchGui.editorTab.activeTabIndex === 1 && !state.scratchGui.mode.isPlayerOnly,
    });
    addon.tab.redux.initialize();
    if (!("colorIndex" in addon.tab.redux.state.scratchPaint.fillMode)) {
      console.error("Detected new paint editor; this will be supported in future versions.");
      return;
    }
    if (addon.tab.redux && typeof prevEventHandler === "function") {
      addon.tab.redux.removeEventListener("statechanged", prevEventHandler);
      prevEventHandler = null;
    }
    if (addon.tab.editorMode !== "editor") continue;
    // Remember which menu this picker belongs to; the menu may already be closing when the field blurs
    const fillOrStroke = getOpenColorMenu();
    const defaultColor = getColor(fillOrStroke);
    const saColorPicker = Object.assign(document.createElement("div"), {
      className: "sa-color-picker sa-color-picker-paint",
    });
    addon.tab.displayNoneWhileDisabled(saColorPicker);
    const saColorPickerColor = Object.assign(document.createElement("input"), {
      className: "sa-color-picker-color sa-color-picker-paint-color",
      type: "color",
      value: defaultColor || "#000000",
    });
    const inputClass = document.querySelector('[class*="fixed-tools_costume-input"]').className.split(" ")[0];
    const saColorPickerText = Object.assign(document.createElement("input"), {
      className: `sa-color-picker-text sa-color-picker-paint-text ${inputClass}`,
      type: "text",
      pattern: "^#?([0-9a-fA-F]{3}){1,2}$",
      placeholder: msg("hex"),
      value: defaultColor || "",
    });
    saColorPickerColor.addEventListener("input", () =>
      setColor((saColorPickerText.value = saColorPickerColor.value), fillOrStroke)
    );
    saColorPickerText.addEventListener("input", () => {
      const { value } = saColorPickerText;
      if (!fullHexRegex.test(value)) return;
      setColor((saColorPickerColor.value = normalizeHex(value)), fillOrStroke);
    });
    saColorPickerText.addEventListener("change", () => {
      const { value } = saColorPickerText;
      if (!getHexRegex().test(value)) return;
      setColor((saColorPickerColor.value = normalizeHex(value)), fillOrStroke);
    });
    saColorPickerText.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saColorPickerText.blur();
    });
    prevEventHandler = ({ detail }) => {
      if (
        detail.action.type === "scratch-paint/color-index/CHANGE_COLOR_INDEX" ||
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_COLOR" ||
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_COLOR_2" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_COLOR" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_COLOR_2" ||
        detail.action.type === "scratch-paint/select/CHANGE_SELECTED_ITEMS" ||
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_GRADIENT_TYPE" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_GRADIENT_TYPE"
      ) {
        updateColor(saColorPickerColor, saColorPickerText, fillOrStroke);
      }
    };
    addon.tab.redux.addEventListener("statechanged", prevEventHandler);
    saColorPicker.appendChild(saColorPickerColor);
    saColorPicker.appendChild(saColorPickerText);
    element.parentElement.insertBefore(saColorPicker, element);
  }
};
