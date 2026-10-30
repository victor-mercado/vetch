// pSVG: Snapping for points dragged with the point selection (reshape) tool. The dragged point snaps onto other
// points, the page center and object centers; otherwise it lines up with other points, the page and objects
// along each axis.
import PointTool from "scratch-paint/src/helper/selection-tools/point-tool.js";
import { getSelectedSegments } from "scratch-paint/src/helper/selection.js";
import createSnapPoints from "./genSnapPoints.js";
import { loadModules } from "./helpers.js";
import { snapOn, threshold, guideColor } from "./state.js";

export const updatePointTool = (paper) => {
  const lib = loadModules(paper);
  const {
    math: { checkPointsClose },
    layer: { getLayer },
  } = lib;

  const guideData = { isHelperItem: true, noSelect: true, noHover: true, saPaintSnapGuide: true };
  let guides = [];

  const removeGuides = () => {
    for (const guide of guides) guide.remove();
    guides = [];
  };

  const addGuideLine = (from, to) => {
    const line = new paper.Path.Line({
      from,
      to,
      strokeColor: new paper.Color(guideColor),
      strokeWidth: 1 / paper.view.zoom,
      guide: true,
      data: guideData,
      insert: false,
    });
    getLayer("isGuideLayer").addChild(line);
    guides.push(line);
  };

  const addGuidePoint = (center) => {
    const point = new paper.Group({
      children: [
        new paper.Path.Circle({ center, radius: 5.5 / paper.view.zoom, fillColor: "black", opacity: 0.12, insert: false }),
        new paper.Path.Circle({ center, radius: 4 / paper.view.zoom, fillColor: new paper.Color(guideColor), insert: false }),
      ],
      guide: true,
      data: guideData,
      insert: false,
    });
    getLayer("isGuideLayer").addChild(point);
    guides.push(point);
  };

  // Everything the dragged point can snap to. The points that aren't being dragged stay where they are, so this
  // is worked out once per drag.
  const getSnapTargets = () => {
    const paintLayer = getLayer("isPaintingLayer");
    const targets = { points: [], xs: [], ys: [] };
    const { to } = createSnapPoints(paper, new paper.Rectangle(), lib, paintLayer.children);
    for (const target of Object.values(to)) {
      if (target.type === "point") targets.points.push(target.value);
      else if (target.type === "xcoord" || target.type === "itemSideVert") targets.xs.push(target.value);
      else if (target.type === "ycoord" || target.type === "itemSideHoriz") targets.ys.push(target.value);
    }
    const addSegments = (item) => {
      if (item.data.isHelperItem || item.guide || item.locked) return;
      if (item.children) {
        for (const child of item.children) addSegments(child);
      } else if (item.segments) {
        for (const segment of item.segments) {
          if (segment.selected) continue;
          targets.points.push(segment.point);
          targets.xs.push(segment.point.x);
          targets.ys.push(segment.point.y);
        }
      }
    };
    for (const item of paintLayer.children) addSegments(item);
    return targets;
  };

  const closest = (values, value, maxDistance) => {
    let best = null;
    for (const candidate of values) {
      const distance = Math.abs(candidate - value);
      if (distance < maxDistance && (best === null || distance < Math.abs(best - value))) best = candidate;
    }
    return best;
  };

  // Where the dragged point goes: onto a nearby point, or lined up along each axis
  const snap = (point, targets) => {
    const maxDistance = threshold / paper.view.zoom;
    let snapPoint = null;
    for (const target of targets.points) {
      if (
        checkPointsClose(point, target, maxDistance) &&
        (!snapPoint || point.getDistance(target) < point.getDistance(snapPoint))
      ) {
        snapPoint = target;
      }
    }
    if (snapPoint) {
      addGuidePoint(snapPoint);
      return snapPoint;
    }

    const snapped = point.clone();
    const bounds = paper.view.bounds;
    const x = closest(targets.xs, point.x, maxDistance);
    const y = closest(targets.ys, point.y, maxDistance);
    if (x !== null) snapped.x = x;
    if (y !== null) snapped.y = y;
    if (x !== null) addGuideLine(new paper.Point(x, bounds.top), new paper.Point(x, bounds.bottom));
    if (y !== null) addGuideLine(new paper.Point(bounds.left, y), new paper.Point(bounds.right, y));
    return snapped;
  };

  const oldMouseDown = PointTool.prototype.onMouseDown;
  PointTool.prototype.onMouseDown = function (hitProperties) {
    oldMouseDown.call(this, hitProperties);
    this.saDraggedSegment = hitProperties.hitResult.segment;
    this.saSnapTargets = null;
  };

  const oldMouseDrag = PointTool.prototype.onMouseDrag;
  PointTool.prototype.onMouseDrag = function (event) {
    removeGuides();
    // Shift keeps the drag to 45° angles instead
    if (!snapOn || event.modifiers.shift || !this.saDraggedSegment) {
      oldMouseDrag.call(this, event);
      return;
    }

    // A click will deselect, but a drag will not
    this.deselectOnMouseUp = null;
    this.invertDeselect = false;
    this.deleteOnMouseUp = null;
    this.lastPoint = event.point;

    const selectedSegments = getSelectedSegments();
    for (const segment of selectedSegments) {
      if (!segment.origPoint) segment.origPoint = segment.point.clone();
    }
    if (!this.saSnapTargets) this.saSnapTargets = getSnapTargets();

    const dragged = this.saDraggedSegment;
    const dragVector = event.point.subtract(event.downPoint);
    const start = dragged.origPoint || dragged.point;
    const snapVector = snap(start.add(dragVector), this.saSnapTargets).subtract(start);
    for (const segment of selectedSegments) {
      segment.point = segment.origPoint.add(snapVector);
    }
  };

  const oldMouseUp = PointTool.prototype.onMouseUp;
  PointTool.prototype.onMouseUp = function (...args) {
    removeGuides();
    this.saDraggedSegment = null;
    this.saSnapTargets = null;
    return oldMouseUp.apply(this, args);
  };
};
