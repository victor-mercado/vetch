import React, { useEffect, useState } from 'react';
import { Provider } from 'react-intl-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { intlReducer } from 'react-intl-redux';

// 1. Import the main component normally
import PaintEditor from 'scratch-paint';

// 2. The Bypass: Reach directly into the package's internal files to grab the reducer
import paintReducer from 'scratch-paint/src/reducers/scratch-paint-reducer';

// 3. Assemble the Redux store with the missing puzzle piece
const reducers = combineReducers({
  intl: intlReducer,
  scratchPaint: paintReducer
});
const store = createStore(reducers);

// A blank SVG fallback to prevent crashes on completely empty files
const emptySvg = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="360"></svg>';

const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

function App() {
  const [svgData, setSvgData] = useState(emptySvg);
  const [imageId, setImageId] = useState('0');

  useEffect(() => {
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        // Only load the text if it's literally not empty, otherwise load blank template
        setSvgData(message.text?.trim() ? message.text : emptySvg);
        setImageId((prev) => (parseInt(prev, 10) + 1).toString());
      }
    });

    // Tell VS Code the webview is ready to receive the initial file contents
    if (vscode) {
      vscode.postMessage({ type: 'ready' });
    }
  }, []);

  const handleUpdateImage = (isVector, image) => {
    if (vscode && isVector) {
      vscode.postMessage({
        type: 'edit',
        newSvgData: image
      });
    }
  };

  return (
    <Provider store={store}>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <PaintEditor
          imageFormat="svg"
          image={svgData}
          imageId={imageId}
          onUpdateImage={handleUpdateImage}
        />
      </div>
    </Provider>
  );
}

export default App;