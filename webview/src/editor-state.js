/**
 * Editor state that is the same in every open Vetch editor: the selected tool, fill and outline colors,
 * outline width, brush and eraser sizes, squircle corner radius, and font. Each editor reports changes to the extension, which
 * remembers them and passes them on to the other open editors.
 */
import { changeMode } from 'scratch-paint/src/reducers/modes.js';
import { changeFillColor, changeFillColor2, changeFillGradientType } from 'scratch-paint/src/reducers/fill-style.js';
import { changeStrokeColor, changeStrokeColor2, changeStrokeGradientType } from 'scratch-paint/src/reducers/stroke-style.js';
import { changeStrokeWidth } from 'scratch-paint/src/reducers/stroke-width.js';
import { changeBrushSize } from 'scratch-paint/src/reducers/brush-mode.js';
import { changeBrushSize as changeEraserSize } from 'scratch-paint/src/reducers/eraser-mode.js';
import { changeBitBrushSize } from 'scratch-paint/src/reducers/bit-brush-size.js';
import { changeBitEraserSize } from 'scratch-paint/src/reducers/bit-eraser-size.js';
import { changeFont } from 'scratch-paint/src/reducers/font.js';
import { changeCornerRadius } from 'scratch-paint/src/reducers/corner-radius.js';
import { setShapesFilled } from 'scratch-paint/src/reducers/fill-bitmap-shapes.js';
import { BitmapModes } from 'scratch-paint/src/lib/modes.js';
import { isBitmap } from 'scratch-paint/src/lib/format.js';
import { MIXED } from 'scratch-paint/src/helper/style-path.js';

/**
 * Get the shareable editor state from the Redux state. Values that are "mixed" because of the current
 * selection (e.g. two shapes with different fills) keep their value from `previous`.
 */
export function getEditorState(state, previous) {
    const paint = state.scratchPaint;
    const pick = (value, mixed, previousValue) => (value === mixed ? previousValue : value);
    const colorState = (color, previousColor) => ({
        primary: pick(color.primary, MIXED, previousColor && previousColor.primary),
        secondary: pick(color.secondary, MIXED, previousColor && previousColor.secondary),
        gradientType: color.gradientType
    });
    return {
        mode: paint.mode,
        fillColor: colorState(paint.color.fillColor, previous && previous.fillColor),
        strokeColor: colorState(paint.color.strokeColor, previous && previous.strokeColor),
        strokeWidth: pick(paint.color.strokeWidth, null, previous && previous.strokeWidth),
        brushSize: paint.brushMode.brushSize,
        eraserSize: paint.eraserMode.brushSize,
        bitBrushSize: paint.bitBrushSize,
        bitEraserSize: paint.bitEraserSize,
        cornerRadius: paint.cornerRadius,
        font: paint.font,
        fillBitmapShapes: paint.fillBitmapShapes
    };
}

/**
 * Make the editor match a shared editor state.
 */
export function applyEditorState(store, editorState) {
    if (!editorState) return;
    const { dispatch } = store;
    const paint = store.getState().scratchPaint;

    const applyColor = (current, target, changeColor, changeColor2, changeGradientType) => {
        if (!target) return;
        if (target.primary !== undefined && target.primary !== current.primary) dispatch(changeColor(target.primary));
        if (target.secondary !== undefined && target.secondary !== current.secondary) dispatch(changeColor2(target.secondary));
        if (target.gradientType && target.gradientType !== current.gradientType) {
            dispatch(changeGradientType(target.gradientType));
        }
    };
    applyColor(paint.color.fillColor, editorState.fillColor, changeFillColor, changeFillColor2, changeFillGradientType);
    applyColor(paint.color.strokeColor, editorState.strokeColor,
        changeStrokeColor, changeStrokeColor2, changeStrokeGradientType);

    const applyNumber = (current, target, change) => {
        if (typeof target === 'number' && target !== current) dispatch(change(target));
    };
    applyNumber(paint.color.strokeWidth, editorState.strokeWidth, changeStrokeWidth);
    applyNumber(paint.brushMode.brushSize, editorState.brushSize, changeBrushSize);
    applyNumber(paint.eraserMode.brushSize, editorState.eraserSize, changeEraserSize);
    applyNumber(paint.bitBrushSize, editorState.bitBrushSize, changeBitBrushSize);
    applyNumber(paint.bitEraserSize, editorState.bitEraserSize, changeBitEraserSize);
    applyNumber(paint.cornerRadius, editorState.cornerRadius, changeCornerRadius);

    if (typeof editorState.font === 'string' && editorState.font !== paint.font) {
        dispatch(changeFont(editorState.font));
    }
    if (typeof editorState.fillBitmapShapes === 'boolean' && editorState.fillBitmapShapes !== paint.fillBitmapShapes) {
        dispatch(setShapesFilled(editorState.fillBitmapShapes));
    }

    // Switch tools last so the new tool starts with the colors above. Only switch to a tool that works with
    // this editor's image (vector tools for vector images, bitmap tools for bitmap images).
    const { mode } = editorState;
    if (typeof mode === 'string' && mode !== paint.mode && (mode in BitmapModes) === isBitmap(paint.format)) {
        dispatch(changeMode(mode));
    }
}
