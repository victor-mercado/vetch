/**
 * Point editing helpers for the Vetch SVG editor.
 * Provides midpoint insertion and line caps for the point selection (reshape) tool.
 */
import paper from '@scratch/paper';
import { getSelectedLeafItems, getSelectedSegments } from './selection';

/**
 * Get the curve that directly connects two points of the same path, or null if they aren't neighbors.
 */
function getConnectingCurve(segmentA, segmentB) {
    if (segmentA.path !== segmentB.path) return null;
    // A segment's curve runs from it to the next segment (wrapping around on closed paths)
    if (segmentA.next === segmentB) return segmentA.curve;
    if (segmentB.next === segmentA) return segmentB.curve;
    return null;
}

/**
 * Get the curve between the two selected points, if exactly two connected points are selected.
 */
function getSelectedCurve() {
    const segments = getSelectedSegments();
    if (segments.length !== 2) return null;
    return getConnectingCurve(segments[0], segments[1]);
}

/**
 * Check if Midpoint can be used (exactly two selected points joined by a line or curve).
 */
export function canInsertMidpoint() {
    return getSelectedCurve() !== null;
}

/**
 * Split a curve halfway along its length, keeping its shape.
 * @returns {paper.Segment} the new point
 */
export function divideCurveAtMidpoint(curve) {
    return curve.path.divideAt(curve.getLocationAt(curve.length / 2));
}

/**
 * Midpoint: Add a point exactly halfway between the two selected points and select it.
 */
export function insertMidpoint(setSelectedItems, onUpdateImage) {
    const curve = getSelectedCurve();
    if (!curve) return;

    const newSegment = divideCurveAtMidpoint(curve);
    if (!newSegment) return;
    // Match clicking on a line: a point added to a straight line is made smooth
    if (!newSegment.hasHandles()) newSegment.smooth();

    // Select only the new point so it can be dragged right away
    for (const segment of getSelectedSegments()) {
        segment.selected = false;
    }
    newSegment.selected = true;

    setSelectedItems();
    onUpdateImage();
    if (document.activeElement) document.activeElement.blur();
}

/**
 * Get the selected paths that have ends, and so line caps (compound paths hold the style for their parts).
 */
function getSelectedOpenPaths() {
    const paths = [];
    for (const item of getSelectedLeafItems()) {
        if (!(item instanceof paper.Path) || item.closed) continue;
        const styled = item.parent instanceof paper.CompoundPath ? item.parent : item;
        if (!paths.includes(styled)) paths.push(styled);
    }
    return paths;
}

/**
 * Check if a line cap can be applied (an open path is selected).
 */
export function canSetLineCap() {
    return getSelectedOpenPaths().length > 0;
}

/**
 * Get the line cap shared by the selected open paths: 'butt', 'round', 'square', or null if they differ.
 */
export function getSelectedLineCap() {
    const paths = getSelectedOpenPaths();
    if (paths.length === 0) return null;
    const cap = paths[0].strokeCap;
    return paths.every(path => path.strokeCap === cap) ? cap : null;
}

/**
 * Apply a line cap ('butt', 'round' or 'square') to the selected open paths.
 */
export function setLineCap(cap, onUpdateImage) {
    let changed = false;
    for (const path of getSelectedOpenPaths()) {
        if (path.strokeCap !== cap) {
            path.strokeCap = cap;
            changed = true;
        }
    }
    if (changed) onUpdateImage();
    return changed;
}
