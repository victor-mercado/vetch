/**
 * BooleanToolbar: Adds Expand Stroke, Union, and Subtract buttons
 * to the scratch-paint toolbar by injecting into the DOM.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import paper from '@scratch/paper';
import {
    expandStroke, unionItems, subtractItems,
    canExpandStroke, canUnion, canSubtract
} from './boolean-tools.js';

import expandStrokeIcon from './icons/expand-stroke.svg';
import unionIcon from './icons/union.svg';
import subtractIcon from './icons/subtract.svg';

/**
 * Toolbar button component matching scratch-paint's LabeledIconButton style
 */
function ToolButton({ icon, label, disabled, onClick }) {
    return (
        <span
            role="button"
            className={`vetch-tool-button ${disabled ? 'vetch-tool-disabled' : ''}`}
            onClick={disabled ? undefined : onClick}
            title={label}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.35 : 1,
                padding: '2px 8px',
                userSelect: 'none',
                transition: 'opacity 0.15s',
            }}
        >
            <img
                src={icon}
                alt={label}
                draggable={false}
                style={{ width: '20px', height: '20px' }}
            />
            <span style={{
                fontSize: '0.625rem',
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                color: '#575e75',
                marginTop: '1px',
                whiteSpace: 'nowrap',
            }}>
                {label}
            </span>
        </span>
    );
}

/**
 * The toolbar group containing all three boolean/stroke buttons
 */
function BooleanButtons({ onUpdateImage, store }) {
    const [, forceUpdate] = useState(0);

    // Re-render when selection changes by subscribing to Redux store
    useEffect(() => {
        if (!store) return;
        const unsubscribe = store.subscribe(() => {
            forceUpdate(n => n + 1);
        });
        return unsubscribe;
    }, [store]);

    // Also re-render on paper selection changes
    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate(n => n + 1);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const handleExpandStroke = useCallback(() => {
        expandStroke(null, null, onUpdateImage);
    }, [onUpdateImage]);

    const handleUnion = useCallback(() => {
        unionItems(null, null, onUpdateImage);
    }, [onUpdateImage]);

    const handleSubtract = useCallback(() => {
        subtractItems(null, null, onUpdateImage);
    }, [onUpdateImage]);

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderLeft: '2px dashed hsla(0, 0%, 0%, 0.15)',
            paddingLeft: '12px',
            marginLeft: '4px',
            gap: '0px',
        }}>
            <ToolButton
                icon={expandStrokeIcon}
                label="Stroke"
                disabled={!canExpandStroke()}
                onClick={handleExpandStroke}
            />
            <ToolButton
                icon={unionIcon}
                label="Union"
                disabled={!canUnion()}
                onClick={handleUnion}
            />
            <ToolButton
                icon={subtractIcon}
                label="Subtract"
                disabled={!canSubtract()}
                onClick={handleSubtract}
            />
        </div>
    );
}

/**
 * Inject the boolean toolbar into the scratch-paint fixed tools row.
 * Call this after the editor has mounted.
 */
export function mountBooleanToolbar(onUpdateImage, store) {
    // Wait for the toolbar to appear in the DOM
    const tryMount = () => {
        // Find the fixed tools row - it's the first .row inside .editor-container-top
        const rows = document.querySelectorAll('[class*="fixed-tools_row"]');
        if (!rows.length) return false;

        const toolbar = rows[0];

        // Don't mount twice
        if (toolbar.querySelector('#vetch-boolean-toolbar')) return true;

        // Create container
        const container = document.createElement('div');
        container.id = 'vetch-boolean-toolbar';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        toolbar.appendChild(container);

        // Render React component into it
        const root = createRoot(container);
        root.render(<BooleanButtons onUpdateImage={onUpdateImage} store={store} />);

        return true;
    };

    // Retry until toolbar appears
    if (!tryMount()) {
        const interval = setInterval(() => {
            if (tryMount()) {
                clearInterval(interval);
            }
        }, 200);

        // Stop trying after 10 seconds
        setTimeout(() => clearInterval(interval), 10000);
    }
}
