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
        let text = message.text?.trim() ? message.text : emptySvg;

        let cx = undefined;
        let cy = undefined;

        // Parse Scratch's rotation center format: <!--rotationCenter:X:Y--> (after </svg>)
        const scratchOriginRegex = /<!--rotationCenter:(-?[\d.]+):(-?[\d.]+)-->/;
        const scratchMatch = text.match(scratchOriginRegex);
        if (scratchMatch) {
          cx = parseFloat(scratchMatch[1]);
          cy = parseFloat(scratchMatch[2]);
          // Strip the rotation center comment so it doesn't appear as SVG content
          text = text.replace(scratchOriginRegex, '').trim();
        } else {
          // Legacy fallback: parse old Vetch format <!-- x="..." y="..." -->
          const legacyRegex = /<!--\s*x="([^"]+)"\s*y="([^"]+)"\s*-->/;
          const legacyMatch = text.match(legacyRegex);
          if (legacyMatch) {
            cx = parseFloat(legacyMatch[1]);
            cy = parseFloat(legacyMatch[2]);
            text = text.replace(legacyRegex, '').trim();
          }
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

  // Auto-focus webview on first canvas interaction so keyboard shortcuts work immediately
  useEffect(() => {
    const handleFirstInteraction = (e) => {
      const canvas = document.querySelector('canvas');
      if (canvas && (e.target === canvas || canvas.contains(e.target))) {
        // Focus the document to enable keyboard event capture
        window.focus();
        document.body.focus();

        // Click the currently-active tool button to initialize scratch-paint's keyboard handler
        // This simulates what normally happens when a user clicks a GUI button
        const activeButton = document.querySelector('span[class*="tool-select-base_is-selected"]');
        if (activeButton) {
          activeButton.click();
        }

        // Only need to do this once
        window.removeEventListener('mousedown', handleFirstInteraction, true);
      }
    };

    window.addEventListener('mousedown', handleFirstInteraction, true);

    return () => {
      window.removeEventListener('mousedown', handleFirstInteraction, true);
    };
  }, []);

  // Middle mouse button drag to pan the canvas
  useEffect(() => {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e) => {
      // Middle mouse button (button === 1) to pan
      if (e.button === 1) {
        const canvas = document.querySelector('canvas');
        if (canvas && (e.target === canvas || canvas.contains(e.target))) {
          isPanning = true;
          lastX = e.clientX;
          lastY = e.clientY;
          e.preventDefault();
          e.stopPropagation();
          document.body.style.cursor = 'grabbing';
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

    const handleMouseUp = (e) => {
      if (isPanning && (e.button === 1 || e.buttons === 0)) {
        isPanning = false;
        document.body.style.cursor = '';
      }
    };

    // Prevent default middle-click behavior (auto-scroll)
    const handleAuxClick = (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('auxclick', handleAuxClick, true);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('auxclick', handleAuxClick, true);
    };
  }, []);

  const handleUpdateImage = (isVector, image, centerX, centerY) => {
    if (vscode && isVector) {
      let finalSVG = image;

      // Remove any old-format origin comments from the SVG content
      finalSVG = finalSVG.replace(/<!--\s*x="[^"]+"\s*y="[^"]+"\s*-->/g, '').trim();
      // Remove any existing Scratch rotation center comments
      finalSVG = finalSVG.replace(/<!--rotationCenter:-?[\d.]+:-?[\d.]+-->/g, '').trim();

      if (typeof centerX !== 'undefined' && typeof centerY !== 'undefined') {
        // Append Scratch-compatible rotation center comment after </svg>
        const rcX = Math.round(centerX * 1000) / 1000;
        const rcY = Math.round(centerY * 1000) / 1000;
        finalSVG = `${finalSVG}<!--rotationCenter:${rcX}:${rcY}-->`;
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