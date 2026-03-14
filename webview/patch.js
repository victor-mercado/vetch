import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const basePath = path.resolve(__dirname, 'node_modules/scratch-paint/src');
const viewPath = path.join(basePath, 'helper/view.js');
const layerPath = path.join(basePath, 'helper/layer.js');
const movePath = path.join(basePath, 'helper/selection-tools/move-tool.js');
const scalePath = path.join(basePath, 'helper/selection-tools/scale-tool.js');
const nudgePath = path.join(basePath, 'helper/selection-tools/nudge-tool.js');
const pointPath = path.join(basePath, 'helper/selection-tools/point-tool.js');
const paperCanvasPath = path.join(basePath, 'containers/paper-canvas.jsx');
const updateImageHocPath = path.join(basePath, 'hocs/update-image-hoc.jsx');
const paintEditorPath = path.join(basePath, 'containers/paint-editor.jsx');
const fontsPath = path.join(basePath, 'lib/fonts.js');
const fontDropdownPath = path.join(basePath, 'components/font-dropdown/font-dropdown.jsx');
const fontReducerPath = path.join(basePath, 'reducers/font.js');
const layoutConstantsPath = path.join(basePath, 'lib/layout-constants.js');
const fillToolPath = path.join(basePath, 'helper/tools/fill-tool.js');
const copyPasteHocPath = path.join(basePath, 'hocs/copy-paste-hoc.jsx');
const bbToolPath = path.join(basePath, 'helper/selection-tools/bounding-box-tool.js');
const modeToolsPath = path.join(basePath, 'components/mode-tools/mode-tools.jsx');
const fixedToolsComponentPath = path.join(basePath, 'components/fixed-tools/fixed-tools.jsx');
const fixedToolsContainerPath = path.join(basePath, 'containers/fixed-tools.jsx');
const fixedToolsIconsDir = path.join(basePath, 'components/fixed-tools/icons');
const vetchIconsDir = path.resolve(__dirname, 'src/icons');

function patchFile(filePath, label, replacements) {
    if (!fs.existsSync(filePath)) {
        console.warn(`[patch.js] SKIP: ${filePath} not found`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        if (typeof search === 'string') {
            if (content.includes(search)) {
                if (!content.includes(replace)) {
                    content = content.split(search).join(replace);
                }
            }
        } else {
            // For regex, we don't do a strict include check but we can assume regexes are designed carefully
            content = content.replace(search, replace);
        }
    }
    fs.writeFileSync(filePath, content);
    console.log(`[patch.js] Patched ${label}`);
}

try {
    // ── view.js ──
    // Keep SVG_ART_BOARD at 480x360 so content loads centered.
    // Expand MAX_WORKSPACE_BOUNDS to be enormous.
    // Neuter clampViewBounds so panning is never restricted.
    // Remove getActionBounds intersection so dragging is unrestricted.
    patchFile(viewPath, 'view.js', [
        // Expand MAX_WORKSPACE_BOUNDS to ~20x in each direction
        [
            /const MAX_WORKSPACE_BOUNDS = new paper\.Rectangle\(\s*-ART_BOARD_WIDTH \/ 4,\s*-ART_BOARD_HEIGHT \/ 4,\s*ART_BOARD_WIDTH \* 1\.5,\s*ART_BOARD_HEIGHT \* 1\.5\);/,
            `const MAX_WORKSPACE_BOUNDS = new paper.Rectangle(
    -ART_BOARD_WIDTH * 10,
    -ART_BOARD_HEIGHT * 10,
    ART_BOARD_WIDTH * 21,
    ART_BOARD_HEIGHT * 21);`
        ],
        // Stop workspace bounds from being clamped to MAX_WORKSPACE_BOUNDS
        [
            'bounds = bounds.intersect(MAX_WORKSPACE_BOUNDS.expand(BUFFER));',
            '// pSVG: removed workspace bounds intersection\n    // bounds = bounds.intersect(MAX_WORKSPACE_BOUNDS.expand(BUFFER));'
        ],
        // Re-center on zoom reset
        [
            'paper.project.view.zoom = .5;',
            'paper.project.view.zoom = .5;\n    paper.project.view.center = CENTER;'
        ],
        // Neuter clampViewBounds - make it a no-op so panning is never restricted
        [
            /const clampViewBounds = \(\) => \{[\s\S]*?setWorkspaceBounds\(\);\s*\};/,
            `const clampViewBounds = () => {
    // pSVG: clamping disabled for unbounded canvas
    setWorkspaceBounds();
};`
        ],
        // Remove getActionBounds intersection with MAX_WORKSPACE_BOUNDS
        [
            'return paper.view.bounds.unite(ART_BOARD_BOUNDS).intersect(MAX_WORKSPACE_BOUNDS);',
            '// pSVG: return huge bounds for unrestricted dragging\n    return new paper.Rectangle(-1e6, -1e6, 2e6, 2e6);'
        ],
        // Allow zooming out much further
        [
            'const OUTERMOST_ZOOM_LEVEL = 0.333;',
            'const OUTERMOST_ZOOM_LEVEL = 0.05;'
        ]
    ]);

    // ── layer.js ──
    // Hide outline layer, keep checkerboard as-is for visual reference
    // Disable workspaceMask clipMask to prevent bounds clamping of vectors outside the main box
    patchFile(layerPath, 'layer.js', [
        [
            'outlineLayer.data.isOutlineLayer = true;',
            'outlineLayer.data.isOutlineLayer = true;\n    outlineLayer.visible = false;'
        ],
        [
            'workspaceMask.clipMask = true;',
            '// pSVG: Don\'t constrain graphics mathematically outside MAX bounds\n        // workspaceMask.clipMask = true;'
        ]
    ]);

    // ── move-tool.js ──
    // Remove action bounds clamping from drag
    patchFile(movePath, 'move-tool.js', [
        [
            /const point = event\.point;\s*\n\s*const actionBounds = getActionBounds\(this\.mode in BitmapModes\);\s*\n\s*point\.x = Math\.max\(actionBounds\.left, Math\.min\(point\.x, actionBounds\.right\)\);\s*\n\s*point\.y = Math\.max\(actionBounds\.top, Math\.min\(point\.y, actionBounds\.bottom\)\);/,
            `const point = event.point;
        const actionBounds = getActionBounds(this.mode in BitmapModes);
        // pSVG: drag clamping removed for unbounded canvas`
        ]
    ]);

    // ── scale-tool.js ──
    // Remove action bounds clamping from scaling
    patchFile(scalePath, 'scale-tool.js', [
        [
            /const point = event\.point;\s*\n\s*const bounds = getActionBounds\(this\.isBitmap\);\s*\n\s*point\.x = Math\.max\(bounds\.left, Math\.min\(point\.x, bounds\.right\)\);\s*\n\s*point\.y = Math\.max\(bounds\.top, Math\.min\(point\.y, bounds\.bottom\)\);/,
            `const point = event.point;
        const bounds = getActionBounds(this.isBitmap);
        // pSVG: scale clamping removed for unbounded canvas`
        ]
    ]);

    // ── nudge-tool.js ──
    // Remove bounds clamping from arrow key nudging
    patchFile(nudgePath, 'nudge-tool.js', [
        [
            /const bounds = getActionBounds\(this\.boundingBoxTool\.isBitmap\);[\s\S]*?let translation;\s*\n\s*if \(event\.key === 'up'\) \{\s*\n\s*translation = new paper\.Point\(0, Math\.min\([\s\S]*?\) \{\s*\n\s*translation = new paper\.Point\(Math\.max\(left, Math\.min\(nudgeAmount, right\)\), 0\);\s*\n\s*\}/,
            `// pSVG: nudge clamping removed for unbounded canvas
        let translation;
        if (event.key === 'up') {
            translation = new paper.Point(0, -nudgeAmount);
        } else if (event.key === 'down') {
            translation = new paper.Point(0, nudgeAmount);
        } else if (event.key === 'left') {
            translation = new paper.Point(-nudgeAmount, 0);
        } else if (event.key === 'right') {
            translation = new paper.Point(nudgeAmount, 0);
        }`
        ]
    ]);

    // ── point-tool.js ──  
    // Remove action bounds clamping from point dragging
    patchFile(pointPath, 'point-tool.js', [
        [
            /const point = event\.point;\s*\n\s*const bounds = getActionBounds\(\);\s*\n\s*point\.x = Math\.max\(bounds\.left, Math\.min\(point\.x, bounds\.right\)\);\s*\n\s*point\.y = Math\.max\(bounds\.top, Math\.min\(point\.y, bounds\.bottom\)\);/,
            `const point = event.point;
        const bounds = getActionBounds();
        // pSVG: point clamping removed for unbounded canvas`
        ]
    ]);

    // ── paint-editor.jsx ──
    // Slow down zoom out from immediate 0.05 step
    patchFile(paintEditorPath, 'paint-editor.jsx', [
        [
            'zoomOnSelection(-PaintEditor.ZOOM_INCREMENT);',
            '// pSVG zoom slower\n        const centerPoint = paper.project.view.center;\n        zoomOnSelection(Math.max(-paper.view.zoom / 2, -PaintEditor.ZOOM_INCREMENT));'
        ]
    ]);

    // ── fonts.js ──
    // Remove extra Latin fonts
    patchFile(fontsPath, 'fonts.js', [
        [
            /const Fonts = {[\s\S]*?};\n/,
            `const Fonts = {
    SERIF: 'Serif',
    CHINESE: '"Microsoft YaHei", "微软雅黑", STXihei, "华文细黑"',
    JAPANESE: '"ヒラギノ角ゴ Pro W3", "Hiragino Kaku Gothic Pro", Osaka, "メイリオ", Meiryo, "ＭＳ Ｐゴシック", "MS PGothic"',
    KOREAN: 'Malgun Gothic'
};
`
        ]
    ]);

    // ── font.js reducer ──
    // Change initial and default font to Serif instead of Sans Serif which was removed
    patchFile(fontReducerPath, 'font.js', [
        [
            'const initialState = Fonts.SANS_SERIF;',
            'const initialState = Fonts.SERIF;'
        ]
    ]);

    // ── layout-constants.js ──
    // Prevent the front/back toolbar from collapsing into the 'More' menu
    patchFile(layoutConstantsPath, 'layout-constants.js', [
        [
            'fullSizeEditorMinWidth: 1274',
            'fullSizeEditorMinWidth: 0'
        ]
    ]);

    // ── font-dropdown.jsx ──
    // Remove extra JSX font buttons in the UI
    patchFile(fontDropdownPath, 'font-dropdown.jsx', [
        [
            /<Button\s*className=\{classNames\(styles\.modMenuItem\)\}\s*onClick=\{props\.onChoose\}\s*onMouseOver=\{props\.onHoverSansSerif\}[\s\S]*?<\/Button>/,
            ''
        ],
        [
            /<Button\s*className=\{classNames\(styles\.modMenuItem\)\}\s*onClick=\{props\.onChoose\}\s*onMouseOver=\{props\.onHoverHandwriting\}[\s\S]*?<\/Button>/,
            ''
        ],
        [
            /<Button\s*className=\{classNames\(styles\.modMenuItem\)\}\s*onClick=\{props\.onChoose\}\s*onMouseOver=\{props\.onHoverMarker\}[\s\S]*?<\/Button>/,
            ''
        ],
        [
            /<Button\s*className=\{classNames\(styles\.modMenuItem\)\}\s*onClick=\{props\.onChoose\}\s*onMouseOver=\{props\.onHoverCurly\}[\s\S]*?<\/Button>/,
            ''
        ],
        [
            /<Button\s*className=\{classNames\(styles\.modMenuItem\)\}\s*onClick=\{props\.onChoose\}\s*onMouseOver=\{props\.onHoverPixel\}[\s\S]*?<\/Button>/,
            ''
        ]
    ]);

    // ── paper-canvas.jsx ──
    // Remove the clip mask that hides artwork outside MAX_WORKSPACE_BOUNDS
    patchFile(paperCanvasPath, 'paper-canvas.jsx', [
        [
            /\/\/ Get reference to viewbox\s*\n\s*let mask;\s*\n\s*if \(item\.clipped\) \{[\s\S]*?mask\.clipMask = true;/,
            `// pSVG: Remove any clip mask from the imported SVG entirely
        // (no clipping - allow artwork to exist anywhere on the canvas)
        if (item.clipped) {
            for (const child of item.children) {
                if (child.isClipMask()) {
                    child.clipMask = false;
                    child.remove();
                    break;
                }
            }
        }`
        ]
    ]);

    // ── update-image-hoc.jsx ──
    // Prevent re-adding the workspace clip mask after every SVG export
    patchFile(updateImageHocPath, 'update-image-hoc.jsx', [
        [
            '            // Add back viewbox\n            if (workspaceMask) {\n                paper.project.activeLayer.addChild(workspaceMask);\n                workspaceMask.clipMask = true;\n            }',
            '            // pSVG: Don\'t re-add the workspace clip mask - allow unbounded canvas\n            // if (workspaceMask) {\n            //     paper.project.activeLayer.addChild(workspaceMask);\n            //     workspaceMask.clipMask = true;\n            // }'
        ]
    ]);

    // ── fill-tool.js ──
    // Apply opacity from slider only on click (handleMouseUp), not during hover preview.
    // We do NOT modify _setFillItemColor — it stays vanilla so hover/unhover color restoration works correctly.
    // Instead, we apply opacity directly on the item's color property in handleMouseUp before committing.
    patchFile(fillToolPath, 'fill-tool.js', [
        [
            `    handleMouseUp (event) {
        if (event.event.button > 0) return; // only first mouse button
        if (this.fillItem) {`,
            `    handleMouseUp (event) {
        if (event.event.button > 0) return; // only first mouse button
        if (this.fillItem) {
            // pSVG: Apply opacity from slider directly on the item's color before committing
            const opacityAlpha = (typeof window !== 'undefined' && window.scratchAddons &&
                typeof window.scratchAddons.opacitySliderAlpha === 'number')
                ? window.scratchAddons.opacitySliderAlpha : null;
            if (opacityAlpha !== null) {
                const colorProp = this.fillProperty === 'fill' ? 'fillColor' : 'strokeColor';
                const fillItem = this._getFillItem();
                if (fillItem && fillItem[colorProp]) {
                    fillItem[colorProp] = new paper.Color({
                        red: fillItem[colorProp].red,
                        green: fillItem[colorProp].green,
                        blue: fillItem[colorProp].blue,
                        alpha: opacityAlpha
                    });
                }
            }`
        ]
    ]);

    // ── bounding-box-tool.js ──
    // Redraw selection bounds during drag so the outline follows items
    patchFile(bbToolPath, 'bounding-box-tool.js', [
        [
            `    onMouseDrag (event) {
        if (event.event.button > 0 || !this.mode) return; // only first mouse button
        this._modeMap[this.mode].onMouseDrag(event);

        // Set the cursor for moving a sprite once the drag has actually started (i.e. the mouse has been moved while
        // pressed), so that the mouse doesn't "flash" to the grabbing cursor every time a sprite is clicked.
        if (this.mode === BoundingBoxModes.MOVE) {
            this.setCursor(Cursors.GRABBING);
        }
    }`,
            `    onMouseDrag (event) {
        if (event.event.button > 0 || !this.mode) return; // only first mouse button
        this._modeMap[this.mode].onMouseDrag(event);

        // pSVG: Update selection bounds outline during drag so it follows the items
        if (this.mode === BoundingBoxModes.MOVE) {
            this.setSelectionBounds();
            this.removeBoundsHandles();
            this.setCursor(Cursors.GRABBING);
        }
    }`
        ]
    ]);

    // ── copy-paste-hoc.jsx ──
    // Write to system clipboard on copy, read from system clipboard on paste
    patchFile(copyPasteHocPath, 'copy-paste-hoc.jsx', [
        [
            '            this.props.setClipboardItems(clipboardItems);',
            `            this.props.setClipboardItems(clipboardItems);

            // pSVG: Also write to system clipboard for cross-tab support
            try {
                const clipboardData = JSON.stringify({
                    type: 'vetch-clipboard',
                    items: clipboardItems
                });
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(clipboardData).catch(() => {});
                }
            } catch (e) {
                // Ignore clipboard errors
            }`
        ],
        [
            `        handlePaste () {
            clearSelection(this.props.clearSelectedItems);

            if (this.props.clipboardItems.length === 0) return;`,
            `        handlePaste () {
            clearSelection(this.props.clearSelectedItems);

            // pSVG: Try reading from system clipboard first for cross-tab paste
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    try {
                        const data = JSON.parse(text);
                        if (data && data.type === 'vetch-clipboard' && Array.isArray(data.items) && data.items.length > 0) {
                            // Use system clipboard items
                            this._doPaste(data.items);
                            return;
                        }
                    } catch (e) {
                        // Not valid vetch clipboard data, fall through
                    }
                    // Fall back to Redux clipboard
                    this._doPaste(this.props.clipboardItems);
                }).catch(() => {
                    // Clipboard read failed, use Redux clipboard
                    this._doPaste(this.props.clipboardItems);
                });
                return;
            }

            if (this.props.clipboardItems.length === 0) return;`
        ],
        [
            `        render () {`,
            `        _doPaste (clipboardItems) {
            if (!clipboardItems || clipboardItems.length === 0) return;

            let items = [];
            for (let i = 0; i < clipboardItems.length; i++) {
                const item = paper.Base.importJSON(clipboardItems[i]);
                if (item) {
                    items.push(item);
                }
            }
            if (!items.length) return;
            // If pasting a group or non-raster to bitmap, rasterize first
            if (isBitmap(this.props.format) && !(items.length === 1 && items[0] instanceof paper.Raster)) {
                const group = new paper.Group(items);
                items = [group.rasterize()];
                group.remove();
            }
            for (const item of items) {
                const placedItem = paper.project.getActiveLayer().addChild(item);
                placedItem.selected = true;
                // pSVG: No paste offset - paste at same position for cross-tab consistency
            }
            this.props.setSelectedItems(this.props.format);
            this.props.onUpdateImage();
        }
        render () {`
        ]
    ]);

    // ── mode-tools.jsx ──
    // Make paste button always enabled (system clipboard may have content even if Redux clipboard is empty)
    patchFile(modeToolsPath, 'mode-tools.jsx', [
        [
            `                    <LabeledIconButton
                        disabled={!(props.clipboardItems.length > 0)}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={pasteIcon}
                        title={intl.formatMessage(messages.paste)}
                        onClick={props.onPasteFromClipboard}
                    />`,
            `                    <LabeledIconButton
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={pasteIcon}
                        title={intl.formatMessage(messages.paste)}
                        onClick={props.onPasteFromClipboard}
                    />`
        ]
    ]);

    // ── Copy boolean tool icons into scratch-paint icons dir ──
    const iconsToCopy = ['expand-stroke.svg', 'union.svg', 'subtract.svg'];
    for (const icon of iconsToCopy) {
        const src = path.join(vetchIconsDir, icon);
        const dst = path.join(fixedToolsIconsDir, icon);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
        }
    }
    console.log('[patch.js] Copied boolean tool icons');

    // ── Copy boolean-tools.js helper into scratch-paint ──
    const boolSrc = path.resolve(__dirname, 'src/boolean-tools.js');
    const boolDst = path.join(basePath, 'helper/boolean-tools.js');
    if (fs.existsSync(boolSrc)) {
        fs.copyFileSync(boolSrc, boolDst);
    }
    console.log('[patch.js] Copied boolean-tools.js');

    // ── fixed-tools.jsx (container) ──
    // Add handlers for Expand Stroke, Union, and Subtract
    patchFile(fixedToolsContainerPath, 'fixed-tools container', [
        // Add imports for boolean tools
        [
            `import {bringToFront, sendBackward, sendToBack, bringForward} from '../helper/order';`,
            `import {bringToFront, sendBackward, sendToBack, bringForward} from '../helper/order';
import {expandStroke, unionItems, subtractItems, canExpandStroke, canUnion, canSubtract} from '../helper/boolean-tools';`
        ],
        // Add handler methods to bindAll
        [
            `        bindAll(this, [
            'handleSendBackward',
            'handleSendForward',
            'handleSendToBack',
            'handleSendToFront',
            'handleSetSelectedItems',
            'handleGroup',
            'handleUngroup'
        ]);`,
            `        bindAll(this, [
            'handleSendBackward',
            'handleSendForward',
            'handleSendToBack',
            'handleSendToFront',
            'handleSetSelectedItems',
            'handleGroup',
            'handleUngroup',
            'handleExpandStroke',
            'handleUnion',
            'handleSubtract'
        ]);`
        ],
        // Add handler method implementations after handleUngroup
        [
            `    handleSendBackward () {`,
            `    handleExpandStroke () {
        expandStroke(this.props.clearSelectedItems, this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleUnion () {
        unionItems(this.props.clearSelectedItems, this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleSubtract () {
        subtractItems(this.props.clearSelectedItems, this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleSendBackward () {`
        ],
        // Pass new handlers as props in render
        [
            `                onUngroup={this.handleUngroup}`,
            `                onUngroup={this.handleUngroup}
                onExpandStroke={this.handleExpandStroke}
                onUnion={this.handleUnion}
                onSubtract={this.handleSubtract}`
        ]
    ]);

    // ── fixed-tools.jsx (component) ──
    // Add boolean tool buttons to the toolbar
    patchFile(fixedToolsComponentPath, 'fixed-tools component', [
        // Add icon imports
        [
            `import ungroupIcon from './icons/ungroup.svg';`,
            `import ungroupIcon from './icons/ungroup.svg';
import expandStrokeIcon from './icons/expand-stroke.svg';
import unionIcon from './icons/union.svg';
import subtractIcon from './icons/subtract.svg';

import {canExpandStroke, canUnion, canSubtract} from '../../helper/boolean-tools';`
        ],
        // Add message definitions
        [
            `    more: {
        defaultMessage: 'More',
        description: 'Label for dropdown to access more action buttons',
        id: 'paint.paintEditor.more'
    }`,
            `    more: {
        defaultMessage: 'More',
        description: 'Label for dropdown to access more action buttons',
        id: 'paint.paintEditor.more'
    },
    expandStroke: {
        defaultMessage: 'Expand',
        description: 'Label for the button to expand stroke into geometry',
        id: 'paint.paintEditor.expandStroke'
    },
    union: {
        defaultMessage: 'Union',
        description: 'Label for the button to merge selected shapes',
        id: 'paint.paintEditor.union'
    },
    subtract: {
        defaultMessage: 'Subtract',
        description: 'Label for the button to subtract shapes',
        id: 'paint.paintEditor.subtract'
    }`
        ],
        // Add buttons after the Back button section (after the InputGroup that contains Front/Back)
        [
            `                    {/* To be rotation point */}
                    {/* <InputGroup>
                        <LabeledIconButton
                            imgAlt="Rotation Point"
                            imgSrc={rotationPointIcon}
                            title="Rotation Point"
                            onClick={function () {}}
                        />
                    </InputGroup> */}
                </MediaQuery> : null
            }`,
            `                    {/* To be rotation point */}
                    {/* <InputGroup>
                        <LabeledIconButton
                            imgAlt="Rotation Point"
                            imgSrc={rotationPointIcon}
                            title="Rotation Point"
                            onClick={function () {}}
                        />
                    </InputGroup> */}
                    <InputGroup className={styles.modDashedBorder}>
                        <LabeledIconButton
                            disabled={!canExpandStroke()}
                            hideLabel={hideLabel(intl.locale)}
                            imgSrc={expandStrokeIcon}
                            title={intl.formatMessage(messages.expandStroke)}
                            onClick={props.onExpandStroke}
                        />
                        <LabeledIconButton
                            disabled={!canUnion()}
                            hideLabel={hideLabel(intl.locale)}
                            imgSrc={unionIcon}
                            title={intl.formatMessage(messages.union)}
                            onClick={props.onUnion}
                        />
                        <LabeledIconButton
                            disabled={!canSubtract()}
                            hideLabel={hideLabel(intl.locale)}
                            imgSrc={subtractIcon}
                            title={intl.formatMessage(messages.subtract)}
                            onClick={props.onSubtract}
                        />
                    </InputGroup>
                </MediaQuery> : null
            }`
        ],
        // Add propTypes for the new handlers
        [
            `    onUngroup: PropTypes.func.isRequired,`,
            `    onUngroup: PropTypes.func.isRequired,
    onExpandStroke: PropTypes.func.isRequired,
    onUnion: PropTypes.func.isRequired,
    onSubtract: PropTypes.func.isRequired,`
        ]
    ]);

} catch (error) {
    console.error('[patch.js] Failed:', error);
}
