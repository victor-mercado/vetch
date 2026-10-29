import "../shared/tinycolor-min.js";

export default async function ({ addon, console, msg }) {

  const CONTAINER_WIDTH = 150;
  const HANDLE_WIDTH = 26;
  let prevEventHandler;
  let handleClickOffset;
  let element;
  let labelReadout;
  let saOpacityHandle;
  let saOpacitySlider;
  let saOpacitySliderBg;

  // The color being edited (fill or outline, first or second gradient color) as an rgb(a) string.
  // Returns null if it's transparent, or undefined if there is none (mixed colors or no color menu open).
  const getColor = () => {
    let fillOrStroke;
    const state = addon.tab.redux.state;
    if (state.scratchPaint.modals.fillColor) {
      fillOrStroke = "fill";
    } else if (state.scratchPaint.modals.strokeColor) {
      fillOrStroke = "stroke";
    } else {
      // fillOrStroke = "ihadastroke";
      return;
    }
    const colorType = state.scratchPaint.fillMode.colorIndex;
    const primaryOrSecondary = ["primary", "secondary"][colorType];
    const color = state.scratchPaint.color[`${fillOrStroke}Color`][primaryOrSecondary];
    if (color === "scratch-paint/style-path/mixed") return;
    if (color === null) return null;
    // This value can be arbitrary - it can be HEX, RGB, etc.
    // Use tinycolor to convert them.
    return tinycolor(color).toRgbString();
  };

  const getOpacity = (color) => (color === null ? 0 : Math.round(tinycolor(color).getAlpha() * 100));

  // Set the color through the open color picker, which applies it to the selection and the
  // Fill/Outline state (including its opacity) and keeps the picker's sliders in sync
  const setColor = (color) => {
    if (window.vetchColorPicker) window.vetchColorPicker.setColor(color);
  };

  const setSliderBg = (color) => {
    const hex = tinycolor(color).toHexString(); // remove alpha value
    saOpacitySliderBg.style.background = `linear-gradient(to left, ${hex} 0%, rgba(0, 0, 0, 0) 100%)`;
  };

  const getEventXY = (e) => {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleMouseDown = (event) => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    handleClickOffset = getEventXY(event).x - saOpacityHandle.getBoundingClientRect().left;
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    changeOpacity(scaleMouseToSliderPosition(event));
  };

  const handleClickBackground = (event) => {
    handleClickOffset = HANDLE_WIDTH / 2;
    changeOpacity(scaleMouseToSliderPosition(event));
  };

  const scaleMouseToSliderPosition = (event) => {
    const { x } = getEventXY(event);
    const backgroundBBox = saOpacitySlider.getBoundingClientRect();
    const scaledX = x - backgroundBBox.left - handleClickOffset;
    return Math.max(0, Math.min(100, (100 * scaledX) / (backgroundBBox.width - HANDLE_WIDTH)));
  };

  const showOpacity = (opacity) => {
    labelReadout.textContent = opacity;
    setHandlePos(opacity / 100);
  };

  const changeOpacity = (opacityValue) => {
    const opacity = Math.round(opacityValue);
    showOpacity(opacity);
    const newColor = tinycolor(getColor());
    newColor.setAlpha(opacity / 100);
    setColor(opacity === 100 ? newColor.toHexString() : newColor.toRgbString());
  };

  const setHandlePos = (alphaValue) => {
    saOpacityHandle.style.left = alphaValue * (CONTAINER_WIDTH - HANDLE_WIDTH) + "px";
  };

  // Show the opacity of the color currently being edited
  const syncSlider = () => {
    const color = getColor();
    if (color === undefined) return;
    setSliderBg(color);
    showOpacity(getOpacity(color));
  };

  while (true) {
    element = await addon.tab.waitForElement('[class*="swatch-row_"]', {
      markAsSeen: true,
      reduxCondition: (state) =>
        state.scratchGui.editorTab.activeTabIndex === 1 &&
        !state.scratchGui.mode.isPlayerOnly &&
        state.scratchPaint.selectedItems.length > 0,
    });
    console.log("pSVG Opacity Slider: Found target element!", element);
    addon.tab.redux.initialize();
    if (typeof prevEventHandler === "function") {
      addon.tab.redux.removeEventListener("statechanged", prevEventHandler);
    }

    const containerWrapper = document.createElement("div");
    const rowHeader = Object.assign(document.createElement("div"), {
      className: addon.tab.scratchClass("color-picker_row-header"),
    });

    const saLabelName = Object.assign(document.createElement("span"), {
      className: addon.tab.scratchClass("color-picker_label-name"),
      textContent: "Opacity",
    });

    labelReadout = Object.assign(document.createElement("span"), {
      className: addon.tab.scratchClass("color-picker_label-readout"),
    });

    saOpacitySlider = Object.assign(document.createElement("div"), {
      className: `sa-opacity-slider ${addon.tab.scratchClass("slider_container", "slider_last")}`,
    });
    saOpacitySlider.addEventListener("click", handleClickBackground);

    saOpacitySliderBg = Object.assign(document.createElement("div"), {
      className: "sa-opacity-slider-bg",
    });

    saOpacityHandle = Object.assign(document.createElement("div"), {
      className: `sa-opacity-handle ${addon.tab.scratchClass("slider_handle")}`,
    });
    saOpacityHandle.addEventListener("mousedown", handleMouseDown);
    saOpacityHandle.addEventListener("click", (event) => event.stopPropagation());
    const lastSlider = document.querySelector('[class*="slider_last"]');
    lastSlider.className = addon.tab.scratchClass("slider_container");

    const defaultColor = getColor();
    setSliderBg(defaultColor);
    showOpacity(defaultColor === undefined ? 100 : getOpacity(defaultColor));

    prevEventHandler = ({ detail }) => {
      if (
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_COLOR" ||
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_COLOR_2" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_COLOR" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_COLOR_2" ||
        detail.action.type === "scratch-paint/color-index/CHANGE_COLOR_INDEX" ||
        detail.action.type === "scratch-paint/select/CHANGE_SELECTED_ITEMS"
      ) {
        syncSlider();
      }
    };
    addon.tab.redux.addEventListener("statechanged", prevEventHandler);

    if (addon.tab.redux.state.scratchPaint.format.startsWith("BITMAP")) continue;

    containerWrapper.appendChild(rowHeader);
    containerWrapper.appendChild(saOpacitySlider);
    rowHeader.appendChild(saLabelName);
    rowHeader.appendChild(labelReadout);
    saOpacitySlider.appendChild(saOpacitySliderBg);
    saOpacitySlider.appendChild(saOpacityHandle);
    const brightnessSlider = Array.from(element.parentElement.children).filter(
      (e) => !e.querySelector("[class*=gradient-picker-row_]")
    )[2];
    console.log("pSVG Opacity Slider inserting element:", containerWrapper, "after brightnessSlider:", brightnessSlider);
    brightnessSlider.after(containerWrapper);
  }
}
