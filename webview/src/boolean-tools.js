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
 * Check if an item is a line: an open path with no visible fill.
 */
function isLine(item) {
    return item instanceof paper.Path &&
        !item.closed &&
        !(item.fillColor && item.fillColor.alpha > 0);
}

/**
 * Check if union can be performed (need 2+ selected items, no groups, and not only lines).
 */
export function canUnion() {
    const items = getSelectedRootItems();
    return items.length >= 2 &&
        !items.some(item => item instanceof paper.Group) &&
        !items.every(isLine);
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
 * Unjoined path ends keep the path's line cap (butt, round or square).
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
 * Create the filled outline of a path's stroke, including its line joins and caps.
 * Smooth stretches of the path are outlined with paperjs-offset, and the joins at corners and the caps at
 * the ends are added on top. paperjs-offset leaves gaps (which looked like caps bent inward) wherever a path
 * bends more tightly than the stroke is wide, so those curves are built from short straight pieces instead.
 */
function _createExpandedStroke(path, strokeWidth) {
    const halfWidth = strokeWidth / 2;

    try {
        const pieces = [];
        const subPaths = path instanceof paper.CompoundPath ? path.children : [path];
        for (const subPath of subPaths) {
            pieces.push(..._outlineSubPath(subPath, halfWidth));
            pieces.push(..._createJoins(subPath, halfWidth, path.strokeJoin, path.miterLimit));
            if (!subPath.closed && (path.strokeCap === 'round' || path.strokeCap === 'square')) {
                for (const atStart of [true, false]) {
                    const cap = _createCap(subPath, atStart, halfWidth, path.strokeCap);
                    if (cap) pieces.push(cap);
                }
            }
        }
        if (pieces.length === 0) return null;

        let expanded = pieces[0];
        for (let i = 1; i < pieces.length; i++) {
            expanded = expanded.unite(pieces[i], { insert: false });
        }
        paper.project.activeLayer.addChild(expanded);
        return expanded;
    } catch (err) {
        console.error('Failed to outline stroke:', err);
        return null;
    }
}

/**
 * Outline a path's stroke without its joins and caps.
 */
function _outlineSubPath(path, halfWidth) {
    let curves = path.curves.filter(curve => curve.length > 0);
    if (curves.length === 0) return [];
    if (path.closed) {
        // Start at a corner, if there is one, so no smooth stretch is split in two
        const corner = curves.findIndex((curve, i) => !_isSmoothJoin(curves[(i + curves.length - 1) % curves.length], curve));
        if (corner > 0) curves = curves.slice(corner).concat(curves.slice(0, corner));
        // Smooth all the way around and gently bending: outline it in one go
        if (corner === -1 && curves.every(curve => _bendsGently(curve, halfWidth))) {
            const ring = PaperOffset.offsetStroke(path, halfWidth, { join: 'bevel', insert: false });
            if (ring && _coversCenterLine(ring, path)) return [ring];
        }
    }

    const pieces = [];
    let stretch = [];
    const endStretch = () => {
        if (stretch.length > 0) pieces.push(..._outlineStretch(stretch, halfWidth));
        stretch = [];
    };
    curves.forEach((curve, i) => {
        const previous = i > 0 ? curves[i - 1] : (path.closed ? curves[curves.length - 1] : null);
        const smooth = previous && _isSmoothJoin(previous, curve);
        const gentle = _bendsGently(curve, halfWidth);
        if (!(gentle && smooth && stretch.length > 0)) {
            endStretch();
            // Separately outlined parts meet at this smooth point; round over the seam between them
            if (smooth) pieces.push(new paper.Path.Circle({ center: curve.point1, radius: halfWidth, insert: false }));
        }
        if (gentle) {
            stretch.push(curve);
        } else {
            pieces.push(..._outlineWithStraightPieces(_pathFromCurves([curve]), halfWidth));
        }
    });
    endStretch();
    return pieces;
}

/**
 * Outline a smooth stretch of gently bending curves with flat ends, using paperjs-offset, which is exact
 * for curves that bend more gently than the stroke is wide.
 */
function _outlineStretch(curves, halfWidth) {
    const stretchPath = _pathFromCurves(curves);
    // Bevel the corners paperjs-offset adds between the pieces it splits curves into (they're tiny, and its
    // round joins there can bulge the wrong way)
    const outline = PaperOffset.offsetStroke(stretchPath, halfWidth, { cap: 'butt', join: 'bevel', insert: false });
    if (outline && _coversCenterLine(outline, stretchPath)) return [outline];
    return _outlineWithStraightPieces(stretchPath, halfWidth);
}

function _pathFromCurves(curves) {
    const segments = [new paper.Segment(curves[0].point1)];
    for (const curve of curves) {
        segments[segments.length - 1].handleOut = curve.handle1;
        segments.push(new paper.Segment(curve.point2, curve.handle2, null));
    }
    return new paper.Path({ segments, insert: false });
}

/**
 * Outline a path's stroke with flat ends from short straight pieces, for curves that bend too tightly for
 * paperjs-offset. The gaps on both sides of each bend between pieces are filled in.
 */
function _outlineWithStraightPieces(path, halfWidth) {
    path.flatten(Math.max(halfWidth / 200, 0.02));
    const points = path.segments.map(segment => segment.point);
    const pieces = [];
    let previousAcross = null;
    for (let i = 0; i < points.length - 1; i++) {
        const along = points[i + 1].subtract(points[i]);
        if (along.isZero()) continue;
        const across = along.normalize(halfWidth).rotate(90);
        pieces.push(_polygon([
            points[i].add(across), points[i + 1].add(across), points[i + 1].subtract(across), points[i].subtract(across)
        ]));
        if (previousAcross) {
            pieces.push(_polygon([points[i], points[i].add(previousAcross), points[i].add(across)]));
            pieces.push(_polygon([points[i], points[i].subtract(previousAcross), points[i].subtract(across)]));
        }
        previousAcross = across;
    }
    return pieces;
}

/**
 * Check if a curve bends more gently than the stroke is wide everywhere along it.
 */
function _bendsGently(curve, halfWidth) {
    for (let i = 0; i <= 20; i++) {
        if (Math.abs(curve.getCurvatureAtTime(i / 20)) * halfWidth >= 0.95) return false;
    }
    return true;
}

/**
 * Check that an outline covers its path's center line (a broken outline leaves parts of it out).
 */
function _coversCenterLine(outline, path) {
    for (let i = 1; i < 20; i++) {
        if (!outline.contains(path.getPointAt(path.length * i / 20))) return false;
    }
    return true;
}

/**
 * Check if one curve continues into the next without a corner.
 */
function _isSmoothJoin(before, after) {
    const tangentIn = before.getTangentAtTime(1);
    const tangentOut = after.getTangentAtTime(0);
    return Math.abs(tangentIn.cross(tangentOut)) < 1e-3 && tangentIn.dot(tangentOut) > 0;
}

/**
 * Create the shapes that fill the outside of each corner between curves, matching the path's line join
 * ('miter', 'round' or 'bevel'). Miters longer than the miter limit are beveled, as when drawn.
 */
function _createJoins(path, halfWidth, join, miterLimit) {
    const joins = [];
    const curves = path.curves;
    for (let i = 0; i < curves.length; i++) {
        // The corner where each curve starts, between it and the curve before it
        const before = i > 0 ? curves[i - 1] : (path.closed ? curves[curves.length - 1] : null);
        const after = curves[i];
        // Smooth points don't need a join
        if (!before || before.length === 0 || after.length === 0 || _isSmoothJoin(before, after)) continue;
        const tangentIn = before.getTangentAtTime(1);
        const tangentOut = after.getTangentAtTime(0);

        const point = after.point1;
        if (join === 'round') {
            joins.push(new paper.Path.Circle({ center: point, radius: halfWidth, insert: false }));
            continue;
        }
        // Edges of the stroke on the outside of the turn, at the end of one curve and the start of the next
        let outsideIn = tangentIn.rotate(90).normalize(halfWidth);
        if (outsideIn.dot(tangentOut) > 0) outsideIn = outsideIn.multiply(-1);
        let outsideOut = tangentOut.rotate(90).normalize(halfWidth);
        if (outsideOut.dot(tangentIn) < 0) outsideOut = outsideOut.multiply(-1);

        const bisector = outsideIn.add(outsideOut);
        // Miter length relative to the stroke width is 1 / cos(half the angle between the edges)
        const cosHalfAngle = bisector.length / (2 * halfWidth);
        if (join === 'miter' && cosHalfAngle > 0 && 1 / cosHalfAngle <= (miterLimit || 10)) {
            const tip = point.add(bisector.normalize(halfWidth / cosHalfAngle));
            joins.push(_polygon([point, point.add(outsideIn), tip, point.add(outsideOut)]));
        } else {
            joins.push(_polygon([point, point.add(outsideIn), point.add(outsideOut)]));
        }
    }
    return joins;
}

function _polygon(points) {
    return new paper.Path({ segments: points, closed: true, insert: false });
}

/**
 * Create the shape a round or square line cap adds at one end of an open path: a half disk or a
 * half square that extends past the end by half the stroke width.
 */
function _createCap(path, atStart, halfWidth, capStyle) {
    const offset = atStart ? 0 : path.length;
    const end = path.getPointAt(offset);
    const tangent = path.getTangentAt(offset);
    if (!end || !tangent || tangent.isZero()) return null;

    // Points outward from the path at this end, and across the path
    const outward = (atStart ? tangent.multiply(-1) : tangent).normalize(halfWidth);
    const across = outward.rotate(90);
    // Overlap the expanded path slightly so the union doesn't leave a seam along the end
    const overlap = outward.multiply(-0.01);
    const sideA = end.add(across);
    const sideB = end.subtract(across);

    let cap;
    if (capStyle === 'round') {
        cap = new paper.Path.Arc({ from: sideA, through: end.add(outward), to: sideB, insert: false });
    } else {
        cap = new paper.Path({ segments: [sideA, sideA.add(outward), sideB.add(outward), sideB], insert: false });
    }
    cap.add(sideB.add(overlap), sideA.add(overlap));
    cap.closed = true;
    return cap;
}

/**
 * Union: Merge all selected items into one shape.
 * Uses the topmost item's fill and stroke style.
 */
export function unionItems(clearSelectedItems, setSelectedItems, onUpdateImage) {
    if (!canUnion()) return;
    const items = getSelectedRootItems();

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
