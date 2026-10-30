/**
 * Rasterize for the Vetch SVG editor: turns shapes into a high resolution image embedded in the SVG,
 * without switching the editor to bitmap mode.
 */
import paper from '@scratch/paper';
import { getAllSelectableRootItems, getSelectedRootItems } from './selection';

// Image pixels per editor unit. The editor works at twice the size of the SVG, so this is 8 pixels per
// SVG unit: 4 times the resolution of Scratch's bitmap mode.
const PIXELS_PER_UNIT = 4;
// Largest image side in pixels, to stay within what browsers can draw into a canvas
const MAX_IMAGE_SIZE = 8192;

/**
 * Rasterize to Bitmap: replace the selected shapes (or everything, if nothing is selected) with an image
 * of them, in the same place and stacking position.
 */
export function rasterizeItems(setSelectedItems, onUpdateImage) {
    let items = getSelectedRootItems();
    if (items.length === 0) {
        items = getAllSelectableRootItems().filter(item => item.layer === paper.project.activeLayer);
    }
    if (items.length === 0) return;

    const bounds = items.reduce((united, item) => united.unite(item.strokeBounds), items[0].strokeBounds);
    if (bounds.width === 0 || bounds.height === 0) return;
    const pixelsPerUnit = Math.min(PIXELS_PER_UNIT, MAX_IMAGE_SIZE / Math.max(bounds.width, bounds.height));

    // Draw copies of the shapes together, so overlapping shapes keep their stacking order
    const copies = items.map(item => {
        const copy = item.clone({ insert: false });
        copy.selected = false;
        return copy;
    });
    const group = new paper.Group(copies);
    const raster = group.rasterize(72 * pixelsPerUnit, false);
    group.remove();

    raster.insertAbove(items[items.length - 1]);
    for (const item of items) {
        item.remove();
    }

    paper.project.deselectAll();
    raster.selected = true;
    setSelectedItems();
    onUpdateImage();
    if (document.activeElement) document.activeElement.blur();
}
