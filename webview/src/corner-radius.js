/**
 * Corner radius for the Vetch SVG editor: rounds the corners where two straight sides meet, finds the radius of
 * corners that are already rounded so it can be changed again, and draws squircles (rectangles with rounded
 * corners).
 *
 * Radii are in SVG pixels. The editor works at twice the size of the SVG.
 */
import paper from '@scratch/paper';
import { getSelectedLeafItems, getSelectedSegments } from './selection';

const EDITOR_UNITS_PER_PIXEL = 2;
const EPSILON = 1e-6;
// Smallest change of direction (in radians) that counts as a corner
const MIN_TURN = 1e-3;
// Rounding a corner always leaves at least this much (in editor units) of each straight side, so the corner can
// still be found and changed later. Otherwise a square rounded as far as it goes would become a plain circle.
const MIN_SIDE = 0.01;

function cross(a, b) {
    return (a.x * b.y) - (a.y * b.x);
}

/**
 * Angle (0 to PI) between two directions.
 */
function turnBetween(a, b) {
    return Math.abs(Math.atan2(cross(a, b), a.dot(b)));
}

/**
 * Where the line through `p` going in direction `d` meets the line through `q` going in direction `e`.
 */
function intersect(p, d, q, e) {
    const denominator = cross(d, e);
    if (Math.abs(denominator) < EPSILON) return null;
    return p.add(d.multiply(cross(q.subtract(p), e) / denominator));
}

function isLine(curve) {
    return curve.isStraight() && curve.length > EPSILON;
}

/**
 * If a curve is a rounded corner (an arc, or an arc that has been stretched since), get the corner point where
 * the lines along its two ends meet, and its radius in editor units.
 */
function getArc(curve) {
    const handleOut = curve.handle1;
    const handleIn = curve.handle2;
    if (handleOut.length < EPSILON || handleIn.length < EPSILON) return null;
    const startDirection = handleOut.normalize();
    const endDirection = handleIn.normalize().negate();
    const turn = turnBetween(startDirection, endDirection);
    if (turn < MIN_TURN || turn > Math.PI - MIN_TURN) return null;
    const vertex = intersect(curve.point1, startDirection, curve.point2, endDirection);
    if (!vertex) return null;
    const startLength = vertex.subtract(curve.point1).dot(startDirection);
    const endLength = curve.point2.subtract(vertex).dot(endDirection);
    if (startLength < EPSILON || endLength < EPSILON) return null;

    // Both handles of an arc reach the same fraction of the way to the corner, even after it has been stretched.
    // For a circular arc that fraction depends on how far the arc turns.
    const startRatio = handleOut.length / startLength;
    const endRatio = handleIn.length / endLength;
    const arcRatio = 4 / 3 * Math.tan(turn / 4) / Math.tan(turn / 2);
    if (Math.abs(startRatio - endRatio) > 0.1 * Math.max(startRatio, endRatio) ||
        startRatio < 0.6 * arcRatio || startRatio > 1.6 * arcRatio) {
        return null;
    }
    return { vertex, radius: (startLength + endLength) / 2 / Math.tan(turn / 2) };
}

/**
 * Find the corners of a path that `isTarget` accepts (given the segments that make up each corner).
 * @returns {?object} the radius of each of those corners, and the points of the path with those corners made
 *     sharp again; or null if the path has no such corners
 */
function getCorners(path, isTarget) {
    const curves = path.curves;
    const lines = curves.map(isLine);
    // Only paths with straight sides have corners (so circles and ovals aren't turned into rounded squares)
    if (!lines.includes(true)) return null;

    const count = curves.length;
    const previousCurve = index => (index > 0 ? index - 1 : (path.closed ? count - 1 : -1));
    const nextCurve = index => (index < count - 1 ? index + 1 : (path.closed ? 0 : -1));
    const joinsSmoothly = (before, after) => {
        const a = curves[before].getTangentAtTime(1);
        const b = curves[after].getTangentAtTime(0);
        return Math.abs(cross(a, b)) < 1e-3 && a.dot(b) > 0;
    };

    // An arc is a rounded corner when it continues smoothly from and into straight sides or other arcs
    const arcs = curves.map((curve, index) => (lines[index] ? null : getArc(curve)));
    const corners = arcs.map((arc, index) => {
        const before = previousCurve(index);
        const after = nextCurve(index);
        if (!arc || before < 0 || after < 0) return null;
        if (!(lines[before] || arcs[before]) || !(lines[after] || arcs[after])) return null;
        if (!joinsSmoothly(before, index) || !joinsSmoothly(index, after)) return null;
        return isTarget([curves[index].segment1, curves[index].segment2]) ? arc : null;
    });

    const radii = [];
    const nodes = [];
    path.segments.forEach((segment, index) => {
        const before = index > 0 ? index - 1 : (path.closed ? count - 1 : -1);
        const after = index < count ? index : -1;
        const cornerBefore = before >= 0 && corners[before];
        const cornerAfter = after >= 0 && corners[after];
        const lineBefore = before >= 0 && lines[before];
        const lineAfter = after >= 0 && lines[after];
        // The ends of a rounded corner's arc go away: the sides next to it run all the way to the sharp corner
        const isArcEnd = (cornerBefore || cornerAfter) && (cornerBefore || lineBefore) && (cornerAfter || lineAfter);
        if (!isArcEnd) {
            const isSharpCorner = !cornerBefore && !cornerAfter && lineBefore && lineAfter &&
                !joinsSmoothly(before, after) && isTarget([segment]);
            if (isSharpCorner) radii.push(0);
            nodes.push({
                point: segment.point,
                handleIn: cornerBefore || lineBefore ? null : segment.handleIn,
                handleOut: cornerAfter || lineAfter ? null : segment.handleOut,
                selected: segment.selected,
                corner: isSharpCorner
            });
        }
        if (cornerAfter) {
            radii.push(cornerAfter.radius);
            nodes.push({
                point: cornerAfter.vertex,
                selected: curves[after].segment1.selected || curves[after].segment2.selected,
                corner: true
            });
        }
    });
    return radii.length > 0 ? { nodes, radii } : null;
}

/**
 * Turn points into path segments, rounding the corners with the given radius (in editor units). Where a side is
 * too short for the radius, the corners on it are rounded as far as they fit.
 */
function roundCorners(nodes, closed, radius) {
    const count = nodes.length;
    const nodeAt = index => (closed ? nodes[(index + count) % count] : nodes[index]);
    const shapes = nodes.map((node, index) => {
        const previous = nodeAt(index - 1);
        const next = nodeAt(index + 1);
        if (!node.corner || !previous || !next || radius <= 0) return null;
        const incoming = node.point.subtract(previous.point);
        const outgoing = next.point.subtract(node.point);
        if (incoming.length < EPSILON || outgoing.length < EPSILON) return null;
        const inDirection = incoming.normalize();
        const outDirection = outgoing.normalize();
        const turn = turnBetween(inDirection, outDirection);
        if (turn < MIN_TURN || turn > Math.PI - MIN_TURN) return null;
        return { inDirection, outDirection, turn, inLength: incoming.length, outLength: outgoing.length };
    });
    // A side with a rounded corner at each end is shared between the two
    const isRounded = index => Boolean(nodeAt(index)) && Boolean(shapes[(index + count) % count]);
    const sideLimit = (length, otherIndex) => (isRounded(otherIndex) ? (length - MIN_SIDE) / 2 : length - MIN_SIDE);

    const segments = [];
    nodes.forEach((node, index) => {
        const shape = shapes[index];
        const tangentLength = shape ? Math.min(radius * Math.tan(shape.turn / 2),
            sideLimit(shape.inLength, index - 1), sideLimit(shape.outLength, index + 1)) : 0;
        if (tangentLength <= EPSILON) {
            const segment = new paper.Segment(node.point, node.handleIn, node.handleOut);
            segment.selected = node.selected;
            segments.push(segment);
            return;
        }
        // A circular arc from one side to the other
        const handleLength = 4 / 3 * Math.tan(shape.turn / 4) * tangentLength / Math.tan(shape.turn / 2);
        const start = new paper.Segment(
            node.point.subtract(shape.inDirection.multiply(tangentLength)),
            null,
            shape.inDirection.multiply(handleLength)
        );
        const end = new paper.Segment(
            node.point.add(shape.outDirection.multiply(tangentLength)),
            shape.outDirection.multiply(-handleLength),
            null
        );
        start.selected = end.selected = node.selected;
        segments.push(start, end);
    });
    return segments;
}

/**
 * How much bigger a path looks than its own coordinates (e.g. inside a scaled group).
 */
function getScale(path) {
    const matrix = path.globalMatrix;
    return Math.sqrt(Math.abs((matrix.a * matrix.d) - (matrix.b * matrix.c))) || 1;
}

/**
 * Get the paths of the selected shapes, including the parts of compound paths.
 */
function getSelectedPaths() {
    const paths = new Set();
    for (const item of getSelectedLeafItems()) {
        if (item instanceof paper.CompoundPath) {
            for (const child of item.children) paths.add(child);
        } else if (item instanceof paper.Path) {
            paths.add(item);
        }
    }
    return [...paths];
}

/**
 * In point selection mode the radius is for the corners at the selected points (or all of a shape's corners, if
 * it's selected as a whole).
 */
function getTargetFilter(selectedPointsOnly) {
    if (!selectedPointsOnly || getSelectedSegments().length === 0) return () => true;
    return segments => segments.some(segment => segment.selected);
}

/**
 * Get the corner radius of the selected shapes, in SVG pixels.
 * @param {boolean} selectedPointsOnly Only look at the corners at the selected points (point selection mode)
 * @returns {?number} the radius; undefined if there are no corners, or null if the corners have different radii
 */
export function getSelectedCornerRadius(selectedPointsOnly) {
    const isTarget = getTargetFilter(selectedPointsOnly);
    let radius;
    for (const path of getSelectedPaths()) {
        const corners = getCorners(path, isTarget);
        if (!corners) continue;
        const scale = getScale(path) / EDITOR_UNITS_PER_PIXEL;
        for (const cornerRadius of corners.radii) {
            if (radius === undefined) {
                radius = cornerRadius * scale;
            } else if (Math.abs(radius - (cornerRadius * scale)) > 0.01) {
                return null;
            }
        }
    }
    return radius;
}

/**
 * Round the corners of the selected shapes.
 * @param {number} radius Corner radius in SVG pixels (0 for sharp corners)
 * @param {boolean} selectedPointsOnly Only round the corners at the selected points (point selection mode)
 * @returns {boolean} whether any shape changed
 */
export function setSelectedCornerRadius(radius, selectedPointsOnly) {
    const isTarget = getTargetFilter(selectedPointsOnly);
    let changed = false;
    for (const path of getSelectedPaths()) {
        const corners = getCorners(path, isTarget);
        if (!corners) continue;
        const pathData = path.pathData;
        const wasSelected = path.selected;
        const segments = roundCorners(corners.nodes, path.closed,
            Math.max(0, radius) * EDITOR_UNITS_PER_PIXEL / getScale(path));
        // Points only stay selected in point selection mode
        if (!selectedPointsOnly) {
            for (const segment of segments) segment.selected = false;
        }
        path.segments = segments;
        if (wasSelected) path.selected = true;
        changed = changed || path.pathData !== pathData;
    }
    return changed;
}

/**
 * Draw a squircle: a rectangle with rounded corners.
 * @param {paper.Rectangle} rectangle Size and position, in editor units
 * @param {number} radius Corner radius in SVG pixels
 * @returns {paper.Path} the new shape
 */
export function createSquircle(rectangle, radius) {
    const nodes = [rectangle.bottomLeft, rectangle.topLeft, rectangle.topRight, rectangle.bottomRight]
        .map(point => ({ point, corner: true }));
    return new paper.Path({
        segments: roundCorners(nodes, true, Math.max(0, radius) * EDITOR_UNITS_PER_PIXEL),
        closed: true
    });
}
