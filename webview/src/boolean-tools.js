/**
 * Boolean and stroke operations for the Vetch SVG editor.
 * Provides Expand Stroke, Union, and Subtract tools using Paper.js.
 */
import paper from '@scratch/paper';
import { PaperOffset } from 'paperjs-offset';
import { getSelectedRootItems } from './selection';

/**
 * Flatten a paper item into an array of Paths/CompoundPaths suitable for boolean operations.
 * Groups are recursed into; non-path items are skipped.
 */
function flattenToPaths(item) {
    const paths = [];
    if (item instanceof paper.Path || item instanceof paper.CompoundPath) {
        paths.push(item);
    } else if (item instanceof paper.Group) {
        for (const child of item.children) {
            paths.push(...flattenToPaths(child));
        }
    }
    return paths;
}

/**
 * Check if an item has a visible stroke that can be expanded.
 */
function hasStroke(item) {
    if (item instanceof paper.Group) {
        return item.children.some(child => hasStroke(child));
    }
    return item.strokeColor &&
        item.strokeWidth > 0 &&
        item.strokeColor.alpha > 0;
}

/**
 * Check if any of the selected items have a stroke that can be expanded.
 */
export function canExpandStroke() {
    const items = getSelectedRootItems();
    return items.length > 0 && items.some(item => hasStroke(item));
}

/**
 * Check if union can be performed (need 2+ selected items).
 */
export function canUnion() {
    const items = getSelectedRootItems();
    return items.length >= 2;
}

/**
 * Check if subtract can be performed (need exactly 2 selected items).
 */
export function canSubtract() {
    const items = getSelectedRootItems();
    return items.length === 2;
}

/**
 * Expand Stroke: Convert strokes into filled geometric shapes.
 * For items with both fill and stroke: keeps the fill shape, creates a new shape from the stroke.
 * For items with only stroke: replaces the stroke with a filled shape.
 * Unjoined path ends use round caps.
 */
export function expandStroke(clearSelectedItems, setSelectedItems, onUpdateImage) {
    const items = getSelectedRootItems();
    if (items.length === 0) return;

    const newItems = [];

    for (const item of items) {
        const paths = flattenToPaths(item);
        for (const path of paths) {
            if (!hasStroke(path)) continue;

            try {
                const strokeColor = path.strokeColor;
                const strokeWidth = path.strokeWidth;
                const hasFill = path.fillColor && path.fillColor.alpha > 0;

                // Create the expanded stroke shape by offsetting the path
                const expanded = _createExpandedStroke(path, strokeWidth);
                if (!expanded) continue;

                expanded.fillColor = strokeColor;
                expanded.strokeColor = null;
                expanded.strokeWidth = 0;

                if (hasFill) {
                    // Keep the original as fill-only, put expanded stroke alongside it
                    const fillShape = path.clone();
                    fillShape.strokeColor = null;
                    fillShape.strokeWidth = 0;

                    expanded.insertAbove(path);
                    fillShape.insertBelow(expanded);
                    path.remove();

                    newItems.push(fillShape, expanded);
                } else {
                    // Stroke-only: replace with filled expanded shape
                    expanded.insertAbove(path);
                    path.remove();

                    newItems.push(expanded);
                }
            } catch (err) {
                console.error('Failed to expand stroke for item:', err);
            }
        }
    }

    if (newItems.length > 0) {
        // Select the new items
        paper.project.deselectAll();
        for (const item of newItems) {
            item.selected = true;
        }
        if (clearSelectedItems) clearSelectedItems();
        if (setSelectedItems) setSelectedItems();
        onUpdateImage();
        if (document.activeElement) document.activeElement.blur();
    }
}

/**
 * Create an expanded stroke shape from a path using paperjs-offset.
 */
function _createExpandedStroke(path, strokeWidth) {
    const halfWidth = strokeWidth / 2;

    try {

        const expanded = PaperOffset.offsetStroke(path, halfWidth, {
            cap: path.strokeCap || 'round',
            join: path.strokeJoin || 'miter',
            limit: path.miterLimit || 10
        });

        if (expanded) {
            paper.project.activeLayer.addChild(expanded);
        }
        return expanded;
    } catch (err) {
        console.error('PaperOffset failed:', err);
        return null;
    }
}

/**
 * Union: Merge all selected items into one shape.
 * Uses the topmost item's fill and stroke style.
 */
export function unionItems(clearSelectedItems, setSelectedItems, onUpdateImage) {
    const items = getSelectedRootItems();
    if (items.length < 2) return;

    // Items are sorted by z-index (ascending), so last is topmost
    const topItem = items[items.length - 1];
    const topFillColor = topItem.fillColor;
    const topStrokeColor = topItem.strokeColor;
    const topStrokeWidth = topItem.strokeWidth;

    // Convert all items to paths for boolean operations
    let allPaths = [];
    for (const item of items) {
        const paths = flattenToPaths(item);
        allPaths = allPaths.concat(paths);
    }

    if (allPaths.length < 2) return;

    // Perform iterative union
    let result = allPaths[0].clone({ insert: false });

    for (let i = 1; i < allPaths.length; i++) {
        try {
            const united = result.unite(allPaths[i], { insert: false });
            result.remove();
            result = united;
        } catch (err) {
            console.error('Union failed for item', i, err);
        }
    }

    // Apply topmost item's style
    result.fillColor = topFillColor;
    result.strokeColor = topStrokeColor;
    result.strokeWidth = topStrokeWidth;

    // Insert result above the topmost item
    paper.project.activeLayer.addChild(result);
    result.insertAbove(topItem);

    // Remove all original items
    for (const item of items) {
        item.remove();
    }

    // Select the result
    paper.project.deselectAll();
    result.selected = true;
    if (clearSelectedItems) clearSelectedItems();
    if (setSelectedItems) setSelectedItems();
    onUpdateImage();
    if (document.activeElement) document.activeElement.blur();
}

/**
 * Subtract: Remove the topmost item's area from the bottommost item.
 * The top item acts as a cookie cutter. Only geometry (fill area) matters.
 */
export function subtractItems(clearSelectedItems, setSelectedItems, onUpdateImage) {
    const items = getSelectedRootItems();
    if (items.length !== 2) return;

    // items[0] = bottom (lowest z-index), items[1] = top (highest z-index, the cutter)
    const bottomItem = items[0];
    const topItem = items[1];

    // Flatten to paths
    const bottomPaths = flattenToPaths(bottomItem);
    const topPaths = flattenToPaths(topItem);

    if (bottomPaths.length === 0 || topPaths.length === 0) return;

    // Create a single shape from the top item (unite all top paths)
    let cutter = topPaths[0].clone({ insert: false });
    for (let i = 1; i < topPaths.length; i++) {
        try {
            const united = cutter.unite(topPaths[i], { insert: false });
            cutter.remove();
            cutter = united;
        } catch (err) {
            console.error('Failed to unite cutter paths:', err);
        }
    }

    // Subtract the cutter from each bottom path
    const results = [];
    for (const bottomPath of bottomPaths) {
        try {
            const result = bottomPath.subtract(cutter, { insert: false });
            result.fillColor = bottomPath.fillColor;
            result.strokeColor = bottomPath.strokeColor;
            result.strokeWidth = bottomPath.strokeWidth;
            results.push(result);
        } catch (err) {
            console.error('Subtract failed:', err);
        }
    }

    cutter.remove();

    if (results.length > 0) {
        // Insert results where the bottom item was
        for (const result of results) {
            paper.project.activeLayer.addChild(result);
            result.insertAbove(bottomItem);
        }

        // Remove originals
        bottomItem.remove();
        topItem.remove();

        // Select the results
        paper.project.deselectAll();
        for (const result of results) {
            result.selected = true;
        }
        if (clearSelectedItems) clearSelectedItems();
        if (setSelectedItems) setSelectedItems();
        onUpdateImage();
        if (document.activeElement) document.activeElement.blur();
    }
}
