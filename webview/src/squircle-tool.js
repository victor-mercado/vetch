/**
 * Squircle tool for the Vetch SVG editor: draws rectangles with rounded corners. It works like the rectangle
 * tool (Shift for a square, Alt to draw from the center), and new shapes get the corner radius from the toolbar.
 */
import paper from '@scratch/paper';
import { styleShape } from '../style-path';
import { getSquareDimensions } from '../math';
import { createSquircle } from '../corner-radius';
import RectTool from './rect-tool';

class SquircleTool extends RectTool {
    constructor(setSelectedItems, clearSelectedItems, setCursor, onUpdateImage) {
        super(setSelectedItems, clearSelectedItems, setCursor, onUpdateImage);
        this.radius = 0;
    }
    /**
     * @param {number} radius Corner radius for new squircles, in SVG pixels
     */
    setRadius(radius) {
        this.radius = radius;
    }
    handleMouseDrag(event) {
        if (event.event.button > 0 || !this.active) return; // only first mouse button

        if (this.isBoundingBoxMode) {
            this.boundingBoxTool.onMouseDrag(event);
            return;
        }

        if (this.rect) {
            this.rect.remove();
        }

        // The same size and position the rectangle tool would draw
        const rect = new paper.Rectangle(event.downPoint, event.point);
        const squareDimensions = getSquareDimensions(event.downPoint, event.point);
        if (event.modifiers.shift) {
            rect.size = squareDimensions.size.abs();
        }
        if (event.modifiers.alt) {
            rect.center = event.downPoint;
        } else if (event.modifiers.shift) {
            rect.center = squareDimensions.position;
        } else {
            rect.center = event.downPoint.add(event.point.subtract(event.downPoint).multiply(0.5));
        }

        this.rect = createSquircle(rect, this.radius);
        styleShape(this.rect, this.colorState);
    }
}

export default SquircleTool;
