/**
 * Blender-style transform shortcuts for the Vetch SVG editor, in the select and point selection tools:
 *   G, then X or Y, then a number: move the selection that many pixels along that axis (right and up are positive)
 *   R, then a number: rotate the selection that many degrees around its center (clockwise is positive)
 * The change shows while it's typed. Enter or a click applies it; Escape or a right click cancels it.
 * In point selection mode the selected points move (or, if a whole shape is selected, the shape).
 */
import paper from '@scratch/paper';
import Modes from '../lib/modes';
import { getSelectedLeafItems, getSelectedRootItems, getSelectedSegments } from './selection';

const EDITOR_UNITS_PER_PIXEL = 2;

/**
 * Get what the shortcuts move or rotate, and the center to rotate around.
 */
function getTargets(mode) {
    if (mode === Modes.RESHAPE) {
        const segments = getSelectedSegments();
        if (segments.length > 0) {
            const points = segments.map(segment => segment.point);
            const bounds = points.reduce((united, point) => united.include(point), new paper.Rectangle(points[0], points[0]));
            return {
                // Where each point and its handles started, so the points can be put back exactly
                segments: segments.map(segment => ({
                    segment,
                    point: segment.point.clone(),
                    handleIn: segment.handleIn.clone(),
                    handleOut: segment.handleOut.clone()
                })),
                center: bounds.center
            };
        }
    }
    const items = mode === Modes.RESHAPE ? getSelectedLeafItems() : getSelectedRootItems();
    if (items.length === 0) return null;
    const bounds = items.reduce((united, item) => united.unite(item.bounds), items[0].bounds);
    return { items, center: bounds.center };
}

class TransformShortcuts {
    /**
     * @param {function} getEditor Gets the editor's current mode, whether text is being edited, and its
     *     onUpdateImage and setSelectedItems callbacks
     */
    constructor(getEditor) {
        this.getEditor = getEditor;
        // The transform being typed: its type ('move' or 'rotate'), axis, typed number, and what it applies to
        this.transform = null;
        this.hud = null;
        this.blockContextMenu = false;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }
    attach() {
        // Listen before everything else, so the keys typed for a transform don't also switch tools or delete things
        window.addEventListener('keydown', this.handleKeyDown, true);
        window.addEventListener('pointerdown', this.handlePointerDown, true);
        window.addEventListener('contextmenu', this.handleContextMenu, true);
        window.addEventListener('blur', this.handleBlur);
    }
    detach() {
        this.cancel();
        window.removeEventListener('keydown', this.handleKeyDown, true);
        window.removeEventListener('pointerdown', this.handlePointerDown, true);
        window.removeEventListener('contextmenu', this.handleContextMenu, true);
        window.removeEventListener('blur', this.handleBlur);
        if (this.hud) this.hud.remove();
        this.hud = null;
    }
    getShortcut(event) {
        if (event.repeat || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !event.key) return null;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
            return null;
        }
        const editor = this.getEditor();
        if (editor.textEditing || (editor.mode !== Modes.SELECT && editor.mode !== Modes.RESHAPE)) return null;
        const key = event.key.toLowerCase();
        return key === 'g' ? 'move' : key === 'r' ? 'rotate' : null;
    }
    start(type) {
        const targets = getTargets(this.getEditor().mode);
        if (!targets) return false;
        this.transform = { type, axis: null, text: '', targets, offset: new paper.Point(0, 0), angle: 0 };
        this.update();
        return true;
    }
    handleKeyDown(event) {
        if (!this.transform) {
            const type = this.getShortcut(event);
            if (type && this.start(type)) {
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }
        // Shortcuts like save and undo apply the transform first
        if (event.ctrlKey || event.metaKey) {
            this.confirm();
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const transform = this.transform;
        const key = event.key || '';
        const lowerKey = key.toLowerCase();
        if (key === 'Escape') {
            this.cancel();
            return;
        } else if (key === 'Enter') {
            this.confirm();
            return;
        } else if (key === 'Backspace') {
            transform.text = transform.text.slice(0, -1);
        } else if (key === '-') {
            // Like Blender, minus flips the direction
            transform.text = transform.text.startsWith('-') ? transform.text.slice(1) : `-${transform.text}`;
        } else if (/^[0-9]$/.test(key)) {
            transform.text += key;
        } else if (key === '.' || key === ',') {
            if (!transform.text.includes('.')) transform.text += '.';
        } else if ((lowerKey === 'x' || lowerKey === 'y') && transform.type === 'move') {
            transform.axis = lowerKey;
        } else if (lowerKey === 'g' || lowerKey === 'r') {
            // Switch between moving and rotating, starting over
            this.apply(new paper.Point(0, 0), 0);
            transform.type = lowerKey === 'g' ? 'move' : 'rotate';
            transform.axis = null;
            transform.text = '';
        } else {
            return;
        }
        this.update();
    }
    handlePointerDown(event) {
        if (!this.transform) return;
        if (event.button === 2) {
            this.cancel();
            this.blockContextMenu = true;
        } else {
            this.confirm();
        }
        // A click on the canvas only finishes the transform, without also selecting or drawing
        if (event.target === paper.view.element) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
    handleContextMenu(event) {
        if (this.blockContextMenu) {
            this.blockContextMenu = false;
            event.preventDefault();
        }
    }
    handleBlur() {
        this.confirm();
    }
    getValue() {
        const value = parseFloat(this.transform.text);
        return isNaN(value) ? 0 : value;
    }
    /**
     * Move the targets by `offset` and rotate them by `angle` degrees from where they started.
     */
    apply(offset, angle) {
        const transform = this.transform;
        const { segments, items, center } = transform.targets;
        if (segments) {
            for (const start of segments) {
                start.segment.point = start.point.rotate(angle, center).add(offset);
                start.segment.handleIn = start.handleIn.rotate(angle);
                start.segment.handleOut = start.handleOut.rotate(angle);
            }
        } else {
            const angleChange = angle - transform.angle;
            const offsetChange = offset.subtract(transform.offset);
            for (const item of items) {
                if (angleChange) item.rotate(angleChange, center);
                if (!offsetChange.isZero()) item.translate(offsetChange);
            }
        }
        transform.offset = offset;
        transform.angle = angle;
    }
    update() {
        const transform = this.transform;
        const value = this.getValue();
        if (transform.type === 'rotate') {
            this.apply(new paper.Point(0, 0), value);
        } else {
            const distance = value * EDITOR_UNITS_PER_PIXEL;
            this.apply(transform.axis === 'x' ? new paper.Point(distance, 0) :
                transform.axis === 'y' ? new paper.Point(0, -distance) : new paper.Point(0, 0), 0);
        }
        // Redraw the selection box around the moved shapes
        this.getEditor().setSelectedItems();
        this.showHud();
    }
    confirm() {
        const transform = this.transform;
        if (!transform) return;
        this.transform = null;
        this.hideHud();
        if (!transform.offset.isZero() || transform.angle) {
            const editor = this.getEditor();
            editor.onUpdateImage();
            editor.setSelectedItems();
        }
    }
    cancel() {
        if (!this.transform) return;
        this.apply(new paper.Point(0, 0), 0);
        this.transform = null;
        this.hideHud();
        this.getEditor().setSelectedItems();
    }
    showHud() {
        if (!this.hud) {
            this.hud = document.createElement('div');
            this.hud.className = 'vetch-transform-hud';
            document.body.appendChild(this.hud);
        }
        const transform = this.transform;
        const value = this.getValue();
        const parts = [];
        const addPart = (text, className) => {
            const span = document.createElement('span');
            span.textContent = text;
            if (className) span.className = className;
            parts.push(span);
        };

        if (transform.type === 'move' && !transform.axis) {
            addPart('Move', 'vetch-transform-label');
            addPart('Press X or Y', 'vetch-transform-hint');
        } else {
            const isMove = transform.type === 'move';
            addPart(isMove ? `Move ${transform.axis.toUpperCase()}` : 'Rotate', 'vetch-transform-label');
            addPart(`${transform.text || '0'}${isMove ? '' : '°'}`, 'vetch-transform-value');
            let direction = '';
            if (value !== 0) {
                if (!isMove) direction = value > 0 ? 'clockwise' : 'counterclockwise';
                else if (transform.axis === 'x') direction = value > 0 ? 'right' : 'left';
                else direction = value > 0 ? 'up' : 'down';
            }
            if (isMove) addPart(`px ${direction}`.trim());
            else if (direction) addPart(direction);
            addPart('Enter to apply · Esc to cancel', 'vetch-transform-hint');
        }
        this.hud.replaceChildren(...parts);

        // Centered at the bottom of the canvas
        const canvas = paper.view && paper.view.element;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            this.hud.style.left = `${rect.left + (rect.width / 2)}px`;
            this.hud.style.top = `${rect.bottom - 16}px`;
        }
        this.hud.style.display = '';
    }
    hideHud() {
        if (this.hud) this.hud.style.display = 'none';
    }
}

export default TransformShortcuts;
