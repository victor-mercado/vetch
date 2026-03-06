import React, { useEffect, useState } from 'react';
import { Provider } from 'react-intl-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { intlReducer } from 'react-intl-redux';

// 1. Import the main component normally
import PaintEditor from 'scratch-paint';
import paper from '@scratch/paper';

// Expose paper globally for addons
window.paper = paper;

// 2. The Bypass: Reach directly into the package's internal files to grab the reducer
import paintReducer from 'scratch-paint/src/reducers/scratch-paint-reducer';

// 3. Assemble the Redux store with the missing puzzle piece
const reducers = combineReducers({
  intl: intlReducer,
  scratchPaint: paintReducer
});
const rawStore = createStore(reducers);

import { createAdapter } from './scratch-addons/adapter.js';
import paintSnapSetup from './scratch-addons/paint-snap/userscript.js';
import paintSkewSetup from './scratch-addons/paint-skew/userscript.js';
import disablePasteOffsetSetup from './scratch-addons/disable-paste-offset/userscript.js';
import colorPickerSetup from './scratch-addons/color-picker/paint-editor.js';
import opacitySliderSetup from './scratch-addons/opacity-slider/userscript.js';

import './scratch-addons/color-picker/style.css';
import './scratch-addons/opacity-slider/style.css';

// Initialize addons
paintSnapSetup(createAdapter(rawStore, "paintSnap")).catch(console.error);
paintSkewSetup(createAdapter(rawStore, "paintSkew")).catch(console.error);
disablePasteOffsetSetup(createAdapter(rawStore, "disablePasteOffset")).catch(console.error);
colorPickerSetup(createAdapter(rawStore, "colorPicker")).catch(console.error);
opacitySliderSetup(createAdapter(rawStore, "opacitySlider")).catch(console.error);

// A blank SVG fallback to prevent crashes on completely empty files
const emptySvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="360"></svg>';

const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
window.vscode = vscode;

function App() {
  const [svgData, setSvgData] = useState(emptySvg);
  const [imageId, setImageId] = useState('0');
  const [rotationCenterX, setRotationCenterX] = useState(undefined);
  const [rotationCenterY, setRotationCenterY] = useState(undefined);

  useEffect(() => {
    const handleMessage = event => {
      const message = event.data;
      if (message.type === 'update') {
        const text = message.text?.trim() ? message.text : emptySvg;

        let cx = undefined;
        let cy = undefined;
        const originRegex = /<!--\s*x="([^"]+)"\s*y="([^"]+)"\s*-->/;
        const match = text.match(originRegex);
        if (match) {
          cx = parseFloat(match[1]);
          cy = parseFloat(match[2]);
        }

        setRotationCenterX(cx);
        setRotationCenterY(cy);
        setSvgData(text);
        setImageId((prev) => (parseInt(prev, 10) + 1).toString());
      }
    };

    window.addEventListener('message', handleMessage);

    // Tell VS Code the webview is ready to receive the initial file contents
    if (vscode) {
      vscode.postMessage({ type: 'ready' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Shift+drag to pan the canvas
  useEffect(() => {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e) => {
      if (e.shiftKey && e.button === 0) {
        // Only start panning if shift is held and we're clicking on the canvas area
        const canvas = document.querySelector('canvas');
        if (canvas && (e.target === canvas || canvas.contains(e.target))) {
          // pSVG: Verify we aren't clicking on a shape/line so we don't break multi-select
          const boundingRect = canvas.getBoundingClientRect();
          const pointX = (e.clientX - boundingRect.left) / paper.view.zoom + paper.view.bounds.left;
          const pointY = (e.clientY - boundingRect.top) / paper.view.zoom + paper.view.bounds.top;
          const hitResult = paper.project.hitTest(new paper.Point(pointX, pointY), {
            fill: true,
            stroke: true,
            segments: true,
            tolerance: 5 / paper.view.zoom
          });

          let clickedOnItem = false;
          if (hitResult && hitResult.item) {
            const item = hitResult.item;
            // Ignore hits on guide items (like background checkerboard or selection guides)
            if (!item.data || (!item.data.isGuideLayer && !item.data.isBackgroundGuideLayer && !item.data.isDragCrosshairLayer && !item.data.isHelperItem && !item.data.saPaintSnapGuide)) {
              // Make sure the item's layer isn't a guide layer
              let currentItem = item;
              while (currentItem && currentItem.parent) {
                if (currentItem.data && (currentItem.data.isGuideLayer || currentItem.data.isBackgroundGuideLayer || currentItem.data.isDragCrosshairLayer)) {
                  currentItem = null; // Mark as guide
                  break;
                }
                currentItem = currentItem.parent;
              }
              if (currentItem) {
                clickedOnItem = true;
              }
            }
          }

          if (!clickedOnItem) {
            isPanning = true;
            lastX = e.clientX;
            lastY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
            document.body.style.cursor = 'grabbing';
          }
        }
      }
    };

    const handleMouseMove = (e) => {
      if (!isPanning) return;
      const dx = (lastX - e.clientX) / paper.view.zoom;
      const dy = (lastY - e.clientY) / paper.view.zoom;
      paper.view.scrollBy(new paper.Point(dx, dy));
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  const handleUpdateImage = (isVector, image, centerX, centerY) => {
    if (vscode && isVector) {
      let finalSVG = image;
      if (typeof centerX !== 'undefined' && typeof centerY !== 'undefined') {
        // Format to Scratch standard x/y comment
        const newX = Math.round(centerX * 1000) / 1000;
        const newY = Math.round(centerY * 1000) / 1000;
        const originComment = `<!-- x="${newX}" y="${newY}" -->`;

        const originRegex = /<!--\s*x="[^"]+"\s*y="[^"]+"\s*-->/;
        if (originRegex.test(finalSVG)) {
          finalSVG = finalSVG.replace(originRegex, originComment);
        } else {
          // Insert right after the <svg> opening tag
          finalSVG = finalSVG.replace(/(<svg[^>]*>)/i, `$1\n  ${originComment}`);
        }
      }

      vscode.postMessage({
        type: 'edit',
        newSvgData: finalSVG
      });
    }
  };

  return (
    <Provider store={rawStore}>
      <div style={{ width: 'calc(100vw - 25px)', height: 'calc(100vh - 25px)' }}>
        <PaintEditor
          imageFormat="svg"
          image={svgData}
          imageId={imageId}
          rotationCenterX={rotationCenterX}
          rotationCenterY={rotationCenterY}
          onUpdateImage={handleUpdateImage}
        />
      </div>
    </Provider>
  );
}

export default App;