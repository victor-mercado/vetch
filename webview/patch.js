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
const copyPasteHocPath = path.join(basePath, 'hocs/copy-paste-hoc.jsx');
const bbToolPath = path.join(basePath, 'helper/selection-tools/bounding-box-tool.js');
const modeToolsPath = path.join(basePath, 'components/mode-tools/mode-tools.jsx');
const fixedToolsComponentPath = path.join(basePath, 'components/fixed-tools/fixed-tools.jsx');
const fixedToolsContainerPath = path.join(basePath, 'containers/fixed-tools.jsx');
const fixedToolsCssPath = path.join(basePath, 'components/fixed-tools/fixed-tools.css');
const fixedToolsIconsDir = path.join(basePath, 'components/fixed-tools/icons');
const colorStyleReducerPath = path.join(basePath, 'lib/make-color-style-reducer.js');
const fillStylePath = path.join(basePath, 'reducers/fill-style.js');
const colorPickerContainerPath = path.join(basePath, 'containers/color-picker.jsx');
const colorIndicatorPath = path.join(basePath, 'containers/color-indicator.jsx');
const colorButtonPath = path.join(basePath, 'components/color-button/color-button.jsx');
const colorsCssPath = path.join(basePath, 'css/colors.css');
const reshapeToolPath = path.join(basePath, 'helper/selection-tools/reshape-tool.js');
const textToolPath = path.join(basePath, 'helper/tools/text-tool.js');
const textModePath = path.join(basePath, 'containers/text-mode.jsx');
const paintEditorComponentPath = path.join(basePath, 'components/paint-editor/paint-editor.jsx');
const keyboardShortcutsHocPath = path.join(basePath, 'hocs/keyboard-shortcuts-hoc.jsx');
const strokeWidthContainerPath = path.join(basePath, 'containers/stroke-width-indicator.jsx');
const strokeWidthComponentPath = path.join(basePath, 'components/stroke-width-indicator.jsx');
const strokeWidthReducerPath = path.join(basePath, 'reducers/stroke-width.js');
const paintEditorCssPath = path.join(basePath, 'components/paint-editor/paint-editor.css');
const paintEditorIconsDir = path.join(basePath, 'components/paint-editor/icons');
const modeToolsContainerPath = path.join(basePath, 'containers/mode-tools.jsx');
const modeToolsIconsDir = path.join(basePath, 'components/mode-tools/icons');
const toolSelectBasePath = path.join(basePath, 'components/tool-select-base/tool-select-base.jsx');
const labeledIconButtonPath = path.join(basePath, 'components/labeled-icon-button/labeled-icon-button.jsx');
const vetchIconsDir = path.resolve(__dirname, 'src/icons');

// Vetch theme colors
const VETCH_VIOLET = '#DC00FF';
const SCRATCH_PURPLE = /#855cd6/gi;

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
            } else if (!content.includes(replace)) {
                console.warn(`[patch.js] WARN: ${label}: search text not found:\n${search.split('\n')[0]}`);
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
        ],
        // Midpoint clicks (see reshape-tool.js) split the curve halfway along its length
        [
            `import {HANDLE_RATIO, snapDeltaToAngle} from '../math';`,
            `import {HANDLE_RATIO, snapDeltaToAngle} from '../math';
import {divideCurveAtMidpoint} from '../point-tools';`
        ],
        [
            `        const newSegment = hitProperties.hitResult.item.divideAt(hitProperties.hitResult.location);`,
            `        // pSVG: Midpoint clicks add the point exactly halfway between the curve's two points
        const newSegment = hitProperties.midpoint ?
            divideCurveAtMidpoint(hitProperties.hitResult.location.curve) :
            hitProperties.hitResult.item.divideAt(hitProperties.hitResult.location);`
        ]
    ]);

    // ── reshape-tool.js ──
    // Shift-click on a selected shape's outline adds a point centered between its two neighbors
    patchFile(reshapeToolPath, 'reshape-tool.js', [
        [
            `            hitResult.type === 'curve') {
            this.mode = ReshapeModes.POINT;
            this._modeMap[this.mode].addPoint(hitProperties);`,
            `            hitResult.type === 'curve') {
            this.mode = ReshapeModes.POINT;
            // pSVG: Shift-click adds the point at the curve's midpoint and selects only that point
            if (event.modifiers.shift) {
                hitProperties.midpoint = true;
                hitProperties.multiselect = false;
            }
            this._modeMap[this.mode].addPoint(hitProperties);`
        ]
    ]);

    // ── paint-editor.jsx ──
    // Slow down zoom out from immediate 0.05 step, pass the Optimize and Save SVG handler to the component,
    // and make Rasterize to Bitmap turn shapes into a high resolution image instead of entering bitmap mode
    patchFile(paintEditorPath, 'paint-editor.jsx', [
        [
            'zoomOnSelection(-PaintEditor.ZOOM_INCREMENT);',
            '// pSVG zoom slower\n        const centerPoint = paper.project.view.center;\n        zoomOnSelection(Math.max(-paper.view.zoom / 2, -PaintEditor.ZOOM_INCREMENT));'
        ],
        [
            `import EyeDropperTool from '../helper/tools/eye-dropper';`,
            `import EyeDropperTool from '../helper/tools/eye-dropper';
import {rasterizeItems} from '../helper/rasterize';`
        ],
        [
            `            'handleZoomReset'
        ]);`,
            `            'handleZoomReset',
            'handleRasterize'
        ]);`
        ],
        [
            `    handleSetSelectedItems () {`,
            `    handleRasterize () {
        // pSVG: Rasterize the selection (or everything) into an image, staying in vector mode
        rasterizeItems(this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleSetSelectedItems () {`
        ],
        [
            `                onUndo={this.props.onUndo}
                onUpdateImage={this.props.onUpdateImage}`,
            `                onOptimizeSvg={this.props.onOptimizeSvg}
                onRasterize={this.handleRasterize}
                onUndo={this.props.onUndo}
                onUpdateImage={this.props.onUpdateImage}`
        ],
        [
            `    onKeyPress: PropTypes.func.isRequired,`,
            `    onKeyPress: PropTypes.func.isRequired,
    onOptimizeSvg: PropTypes.func,`
        ]
    ]);

    // ── text-mode.jsx ──
    // New text is drawn with the fill color only, so a transparent fill (e.g. right after selecting
    // an outline-only line) made typed text invisible. Fall back to the outline color or the default.
    patchFile(textModePath, 'text-mode.jsx', [
        [
            `        const fillColorPresent = fillColor !== MIXED && fillColor !== null;`,
            `        // pSVG: A fully transparent fill counts as no fill
        const fillColorPresent = fillColor !== MIXED && fillColor !== null && new paper.Color(fillColor).alpha > 0;`
        ],
        [
            `        if (!fillColorPresent && !strokeColorPresent) {
            this.props.onChangeFillColor(DEFAULT_COLOR);
            this.props.onChangeStrokeColor(null);
        } else if (!fillColorPresent && strokeColorPresent) {
            this.props.onChangeFillColor(null);
        } else if (fillColorPresent && !strokeColorPresent) {
            this.props.onChangeStrokeColor(null);
        }`,
            `        // pSVG: Never start typing with an invisible fill; borrow the outline color if there is one
        if (!fillColorPresent) {
            this.props.onChangeFillColor(strokeColorPresent ? strokeColor : DEFAULT_COLOR);
            this.props.onChangeStrokeColor(null);
        } else if (!strokeColorPresent) {
            this.props.onChangeStrokeColor(null);
        }`
        ]
    ]);

    // ── text-tool.js ──
    // Redraw the canvas as soon as the text changes instead of waiting for paper's next animation
    // frame, so the drawn text never lags behind (or disagrees with) the hidden textarea being typed in.
    patchFile(textToolPath, 'text-tool.js', [
        [
            `        if (this.mode === TextTool.TEXT_EDIT_MODE) {
            this.textBox.content = this.element.value;
        }
        this.resizeGuide();
    }`,
            `        if (this.mode === TextTool.TEXT_EDIT_MODE) {
            this.textBox.content = this.element.value;
        }
        this.resizeGuide();
        // pSVG: Draw immediately so added/deleted characters show up right away
        paper.view.update();
    }`
        ]
    ]);

    // ── paint-editor.jsx (component) ──
    // The hidden textarea used for text editing shouldn't get OS autocorrect/autocapitalize (macOS).
    // Rename "Convert to Bitmap" and add an "Optimize and Save SVG" button to its left.
    patchFile(paintEditorComponentPath, 'paint-editor component', [
        [
            `import bitmapIcon from './icons/bitmap.svg';`,
            `import bitmapIcon from './icons/bitmap.svg';
import optimizeIcon from './icons/optimize.svg';`
        ],
        [
            `    bitmap: {
        defaultMessage: 'Convert to Bitmap',`,
            `    optimize: {
        defaultMessage: 'Optimize and Save SVG',
        description: 'Label for button that removes unneeded data from the SVG file and saves it',
        id: 'paint.paintEditor.optimize'
    },
    bitmap: {
        defaultMessage: 'Rasterize to Bitmap',`
        ],
        [
            `                    <div className={styles.canvasControls}>
                        {isVector(props.format) ?`,
            `                    <div className={styles.canvasControls}>
                        {/* pSVG: Optimize and Save SVG, then the bitmap/vector conversion button */}
                        <div className={styles.canvasControlsStart}>
                        {isVector(props.format) && props.onOptimizeSvg ?
                            <Button
                                className={styles.bitmapButton}
                                onClick={props.onOptimizeSvg}
                            >
                                <img
                                    className={styles.bitmapButtonIcon}
                                    draggable={false}
                                    src={optimizeIcon}
                                />
                                <span className={styles.buttonText}>
                                    {intl.formatMessage(messages.optimize)}
                                </span>
                            </Button> : null
                        }
                        {isVector(props.format) ?`
        ],
        [
            `                                        {intl.formatMessage(messages.vector)}
                                    </span>
                                </Button> : null
                        }`,
            `                                        {intl.formatMessage(messages.vector)}
                                    </span>
                                </Button> : null
                        }
                        </div>`
        ],
        [
            `                                onClick={props.onSwitchToBitmap}`,
            `                                onClick={props.onRasterize}`
        ],
        [
            `    onSwitchToBitmap: PropTypes.func.isRequired,`,
            `    onOptimizeSvg: PropTypes.func,
    onRasterize: PropTypes.func,
    onSwitchToBitmap: PropTypes.func.isRequired,`
        ],
        [
            `                            ref={props.setTextArea}
                            spellCheck={false}`,
            `                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            ref={props.setTextArea}
                            spellCheck={false}`
        ]
    ]);

    // ── keyboard-shortcuts-hoc.jsx ──
    // In VS Code, Cmd/Ctrl+V while a number field (e.g. the outline width) has focus pastes the Vetch
    // clipboard JSON into it as text, which the field reads as a tiny number like 8e-3003503...
    // Paste shapes onto the canvas instead unless the clipboard actually holds a number.
    patchFile(keyboardShortcutsHocPath, 'keyboard-shortcuts-hoc.jsx', [
        [
            `            bindAll(this, [
                'handleKeyPress',
                'changeToASelectMode',
                'selectAll'
            ]);
        }`,
            `            bindAll(this, [
                'handleKeyPress',
                'handleNumberInputPaste',
                'changeToASelectMode',
                'selectAll'
            ]);
        }
        componentDidMount () {
            document.addEventListener('paste', this.handleNumberInputPaste, true);
        }
        componentWillUnmount () {
            document.removeEventListener('paste', this.handleNumberInputPaste, true);
        }
        handleNumberInputPaste (event) {
            // pSVG: Only let real numbers be pasted into number fields; anything else is a shape paste
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || target.type !== 'number') return;
            const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
            if (/^\\s*[-+]?(\\d+\\.?\\d*|\\.\\d+)\\s*$/.test(text)) return;
            event.preventDefault();
            target.blur();
            this.changeToASelectMode();
            this.props.onPasteFromClipboard();
        }`
        ]
    ]);

    // ── stroke-width-indicator.jsx (container + component) ──
    // Keep outline widths to 2 decimals so stray values can't become microscopic widths,
    // and show long decimals (e.g. from imported SVGs) rounded
    patchFile(strokeWidthContainerPath, 'stroke-width-indicator container', [
        [
            `    handleChangeStrokeWidth (newWidth) {
        let changed`,
            `    handleChangeStrokeWidth (newWidth) {
        // pSVG: Round to 2 decimals
        newWidth = Math.round(newWidth * 100) / 100;
        let changed`
        ]
    ]);
    patchFile(strokeWidthComponentPath, 'stroke-width-indicator component', [
        [
            `            value={props.strokeWidth ? props.strokeWidth : 0}`,
            `            value={props.strokeWidth ? Math.round(props.strokeWidth * 100) / 100 : 0}`
        ],
        // No upper limit on outline width
        [/\n\s*max=\{MAX_STROKE_WIDTH\}/, ''],
        [/import \{MAX_STROKE_WIDTH\} from '\.\.\/reducers\/stroke-width';\n/, '']
    ]);
    // Outline width has no upper limit (brush and eraser sizes keep theirs)
    patchFile(strokeWidthReducerPath, 'stroke-width.js', [
        [
            `        return Math.min(MAX_STROKE_WIDTH, Math.max(0, action.strokeWidth));`,
            `        return Math.max(0, action.strokeWidth); // pSVG: no upper limit`
        ]
    ]);

    // ── keyboard-shortcuts-hoc.jsx ──
    // Single-key tool shortcuts, only without modifier keys (Cmd/Ctrl combinations are handled above them)
    patchFile(keyboardShortcutsHocPath, 'keyboard-shortcuts-hoc.jsx (tool shortcuts)', [
        [
            `const KeyboardShortcutsHOC = function (WrappedComponent) {`,
            `// pSVG: Tool for each shortcut key in vector and bitmap mode (the point selection tool is vector only)
const TOOL_SHORTCUTS = {
    v: [Modes.SELECT, Modes.BIT_SELECT],
    a: [Modes.RESHAPE, null],
    b: [Modes.BRUSH, Modes.BIT_BRUSH],
    e: [Modes.ERASER, Modes.BIT_ERASER],
    f: [Modes.FILL, Modes.BIT_FILL],
    t: [Modes.TEXT, Modes.BIT_TEXT],
    l: [Modes.LINE, Modes.BIT_LINE],
    c: [Modes.OVAL, Modes.BIT_OVAL],
    s: [Modes.RECT, Modes.BIT_RECT]
};

const KeyboardShortcutsHOC = function (WrappedComponent) {`
        ],
        [
            `                } else if (event.key === 'a') {
                    this.changeToASelectMode();
                    event.preventDefault();
                    this.selectAll();
                }
            }
        }`,
            `                } else if (event.key === 'a') {
                    this.changeToASelectMode();
                    event.preventDefault();
                    this.selectAll();
                }
            } else if (!event.shiftKey && !event.altKey && event.key && TOOL_SHORTCUTS[event.key.toLowerCase()]) {
                // pSVG: Switch tools with a single key
                const mode = TOOL_SHORTCUTS[event.key.toLowerCase()][isBitmap(this.props.format) ? 1 : 0];
                if (mode && mode !== this.props.mode) this.props.changeMode(mode);
            }
        }`
        ]
    ]);

    // ── tool-select-base.jsx ──
    // Show each tool's shortcut key in the corner of its button and in its tooltip
    patchFile(toolSelectBasePath, 'tool-select-base.jsx', [
        [
            `const ToolSelectComponent = props => {
    const intl = useIntl();`,
            `// pSVG: Shortcut key for each tool (see keyboard-shortcuts-hoc.jsx), by the tool's label
const TOOL_SHORTCUTS = {
    'paint.selectMode.select': 'V',
    'paint.reshapeMode.reshape': 'A',
    'paint.brushMode.brush': 'B',
    'paint.eraserMode.eraser': 'E',
    'paint.fillMode.fill': 'F',
    'paint.textMode.text': 'T',
    'paint.lineMode.line': 'L',
    'paint.ovalMode.oval': 'C',
    'paint.rectMode.rect': 'S'
};

const ToolSelectComponent = props => {
    const intl = useIntl();
    const shortcut = TOOL_SHORTCUTS[props.imgDescriptor.id];`
        ],
        [
            `            title={intl.formatMessage(props.imgDescriptor)}`,
            `            title={intl.formatMessage(props.imgDescriptor) + (shortcut ? ' (' + shortcut + ')' : '')}`
        ],
        [
            `                src={props.imgSrc}
            />
        </Button>`,
            `                src={props.imgSrc}
            />
            {shortcut ? <span className="vetch-shortcut">{shortcut}</span> : null}
        </Button>`
        ]
    ]);

    // ── labeled-icon-button.jsx ──
    // Optional shortcut key shown in the corner of the button (used for P on Curved/Pointed)
    patchFile(labeledIconButtonPath, 'labeled-icon-button.jsx', [
        [
            `    onClick,
    title,
    ...props
}) => (`,
            `    onClick,
    shortcut,
    title,
    ...props
}) => (`
        ],
        [
            `        {!hideLabel && <span className={styles.editFieldTitle}>{title}</span>}`,
            `        {!hideLabel && <span className={styles.editFieldTitle}>{title}</span>}
        {shortcut ? <span className="vetch-shortcut">{shortcut}</span> : null}`
        ],
        [
            `    onClick: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired`,
            `    onClick: PropTypes.func.isRequired,
    shortcut: PropTypes.string,
    title: PropTypes.string.isRequired`
        ]
    ]);

    // ── mode-tools.jsx (container) ──
    // In point selection mode: P toggles the selected points between curved and pointed, and line caps
    patchFile(modeToolsContainerPath, 'mode-tools container', [
        [
            `import Modes from '../lib/modes';`,
            `import Modes from '../lib/modes';
import {canSetLineCap, getSelectedLineCap, setLineCap} from '../helper/point-tools';`
        ],
        [
            `            'handlePasteFromClipboard',
            'handlePointPoints'
        ]);
    }`,
            `            'handlePasteFromClipboard',
            'handlePointPoints',
            'handleKeyDown',
            'handleSetLineCap'
        ]);
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyDown);
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyDown);
    }
    handleKeyDown (event) {
        // pSVG: P makes the selected points curved, or pointed if they're all curved already
        if (this.props.mode !== Modes.RESHAPE || !event.key || event.key.toLowerCase() !== 'p') return;
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        if (this.hasSelectedUncurvedPoints()) {
            this.handleCurvePoints();
        } else {
            this.handlePointPoints();
        }
    }
    handleSetLineCap (cap) {
        if (setLineCap(cap, this.props.onUpdateImage)) {
            this.props.setSelectedItems(this.props.format);
        }
    }`
        ],
        [
            `                hasSelectedUnpointedPoints={this.hasSelectedUnpointedPoints()}`,
            `                hasSelectedUnpointedPoints={this.hasSelectedUnpointedPoints()}
                canSetLineCap={this.props.mode === Modes.RESHAPE && canSetLineCap()}
                lineCap={this.props.mode === Modes.RESHAPE ? getSelectedLineCap() : null}
                onSetLineCap={this.handleSetLineCap}`
        ]
    ]);

    // ── mode-tools.jsx (component) ──
    // Point selection mode: show P on the button it will press, and add line cap buttons
    patchFile(modeToolsPath, 'mode-tools component (point selection)', [
        [
            `import straightPointIcon from './icons/straight-point.svg';`,
            `import straightPointIcon from './icons/straight-point.svg';
import capButtIcon from './icons/cap-butt.svg';
import capRoundIcon from './icons/cap-round.svg';
import capSquareIcon from './icons/cap-square.svg';`
        ],
        [
            `        pointed: {
            defaultMessage: 'Pointed',
            description: 'Label for the button that converts selected points to sharp points',
            id: 'paint.modeTools.pointed'
        },`,
            `        pointed: {
            defaultMessage: 'Pointed',
            description: 'Label for the button that converts selected points to sharp points',
            id: 'paint.modeTools.pointed'
        },
        capButt: {
            defaultMessage: 'Butt',
            description: 'Label for the button that ends lines flat at their end points',
            id: 'paint.modeTools.capButt'
        },
        capRound: {
            defaultMessage: 'Round',
            description: 'Label for the button that gives lines rounded ends',
            id: 'paint.modeTools.capRound'
        },
        capSquare: {
            defaultMessage: 'Square',
            description: 'Label for the button that ends lines with a square past their end points',
            id: 'paint.modeTools.capSquare'
        },`
        ],
        [
            `    case Modes.RESHAPE:
        return (
            <div className={classNames(props.className, styles.modeTools)}>
                <InputGroup className={classNames(styles.modDashedBorder, styles.modLabeledIconHeight)}>
                    <LabeledIconButton
                        disabled={!props.hasSelectedUncurvedPoints}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={curvedPointIcon}
                        title={intl.formatMessage(messages.curved)}
                        onClick={props.onCurvePoints}
                    />
                    <LabeledIconButton
                        disabled={!props.hasSelectedUnpointedPoints}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={straightPointIcon}
                        title={intl.formatMessage(messages.pointed)}
                        onClick={props.onPointPoints}
                    />
                </InputGroup>`,
            `    case Modes.RESHAPE: {
        // pSVG: P curves the selected points, or points them once they're all curved
        const pCurves = props.hasSelectedUncurvedPoints || !props.hasSelectedUnpointedPoints;
        return (
            <div className={classNames(props.className, styles.modeTools)}>
                <InputGroup className={classNames(styles.modDashedBorder, styles.modLabeledIconHeight)}>
                    <LabeledIconButton
                        disabled={!props.hasSelectedUncurvedPoints}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={curvedPointIcon}
                        shortcut={pCurves ? 'P' : null}
                        title={intl.formatMessage(messages.curved)}
                        onClick={props.onCurvePoints}
                    />
                    <LabeledIconButton
                        disabled={!props.hasSelectedUnpointedPoints}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={straightPointIcon}
                        shortcut={pCurves ? null : 'P'}
                        title={intl.formatMessage(messages.pointed)}
                        onClick={props.onPointPoints}
                    />
                </InputGroup>
                <InputGroup className={classNames(styles.modDashedBorder, styles.modLabeledIconHeight)}>
                    <LabeledIconButton
                        disabled={!props.canSetLineCap}
                        highlighted={props.lineCap === 'butt'}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={capButtIcon}
                        title={intl.formatMessage(messages.capButt)}
                        onClick={() => props.onSetLineCap('butt')}
                    />
                    <LabeledIconButton
                        disabled={!props.canSetLineCap}
                        highlighted={props.lineCap === 'round'}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={capRoundIcon}
                        title={intl.formatMessage(messages.capRound)}
                        onClick={() => props.onSetLineCap('round')}
                    />
                    <LabeledIconButton
                        disabled={!props.canSetLineCap}
                        highlighted={props.lineCap === 'square'}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={capSquareIcon}
                        title={intl.formatMessage(messages.capSquare)}
                        onClick={() => props.onSetLineCap('square')}
                    />
                </InputGroup>`
        ],
        [
            `                        title={intl.formatMessage(messages.delete)}
                        onClick={props.onDelete}
                    />
                </InputGroup>
            </div>
        );
    case Modes.BIT_SELECT:`,
            `                        title={intl.formatMessage(messages.delete)}
                        onClick={props.onDelete}
                    />
                </InputGroup>
            </div>
        );
    }
    case Modes.BIT_SELECT:`
        ],
        [
            `    hasSelectedUnpointedPoints: PropTypes.bool,`,
            `    hasSelectedUnpointedPoints: PropTypes.bool,
    canSetLineCap: PropTypes.bool,
    lineCap: PropTypes.string,
    onSetLineCap: PropTypes.func,`
        ],
        // No upper limit on brush and eraser sizes
        [/\n\s*max=\{MAX_STROKE_WIDTH\}/g, ''],
        [/import \{MAX_STROKE_WIDTH\} from '\.\.\/\.\.\/reducers\/stroke-width';\n/, '']
    ]);

    // ── paint-editor.css ──
    // Row for the buttons at the bottom left (Optimize and Save SVG, Rasterize to Bitmap)
    patchFile(paintEditorCssPath, 'paint-editor.css', [
        [
            `.canvas-controls {
    display: flex;
    height: 36px;`,
            `.canvas-controls-start {
    display: flex;
    gap: calc(2 * $grid-unit);
}

.canvas-controls {
    display: flex;
    height: 36px;`
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

    // ── make-color-style-reducer.js ──
    // Accept rgb()/rgba() colors (not just hex) so the fill/outline colors in Redux can carry opacity.
    // The fill tool, color swatches and opacity slider all read their color from Redux.
    patchFile(colorStyleReducerPath, 'make-color-style-reducer.js', [
        [
            'const hexRegex = /^#([0-9a-f]{3}){1,2}$/i;',
            '// pSVG: Also accept rgb()/rgba() so colors keep their opacity\nconst hexRegex = /^(#([0-9a-f]{3}){1,2}|rgba?\\([\\d\\s.,%]+\\))$/i;'
        ]
    ]);

    // ── fill-style.js ──
    // Default fill color is red
    patchFile(fillStylePath, 'fill-style.js', [
        [
            `const DEFAULT_COLOR = '#9966FF';`,
            `const DEFAULT_COLOR = '#FF0000';`
        ]
    ]);

    // ── color-picker.jsx (container) ──
    patchFile(colorPickerContainerPath, 'color-picker container', [
        // Expose the open picker so the HEX and opacity addons can set colors directly
        // (and keep the HSV sliders in sync) instead of faking an eyedropper pick
        [
            `    getHsv (color) {`,
            `    componentDidMount () {
        window.vetchColorPicker = this;
    }
    componentWillUnmount () {
        if (window.vetchColorPicker === this) window.vetchColorPicker = null;
    }
    setColor (color) {
        const hsv = this.getHsv(color);
        this.setState({
            hue: hsv[0],
            saturation: hsv[1],
            brightness: hsv[2]
        });
        this.props.onChangeColor(color);
    }
    getHsv (color) {`
        ],
        // Keep the current opacity when the hue/saturation/brightness sliders move
        [
            `    handleColorChange () {
        this.props.onChangeColor(hsvToHex(
            this.state.hue,
            this.state.saturation,
            this.state.brightness
        ));
    }`,
            `    handleColorChange () {
        const hex = hsvToHex(
            this.state.hue,
            this.state.saturation,
            this.state.brightness
        );
        // pSVG: Keep the current opacity when the hue/saturation/brightness sliders move
        const current = this.props.colorIndex === 0 ? this.props.color : this.props.color2;
        const alpha = current && current !== MIXED ? parseColor(current).rgba[3] : 1;
        if (alpha < 1) {
            const [r, g, b] = parseColor(hex).rgb;
            this.props.onChangeColor('rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')');
        } else {
            this.props.onChangeColor(hex);
        }
    }`
        ],
        // Use the browser's EyeDropper when available so colors can be picked from anywhere on
        // screen, not just inside the paint canvas. Falls back to Scratch's canvas eyedropper.
        [
            `    handleActivateEyeDropper () {
        this.props.onActivateEyeDropper(`,
            `    handleActivateEyeDropper () {
        // pSVG: Pick from anywhere on screen with the native EyeDropper when it's available
        if (typeof window.EyeDropper === 'function' && !this.props.isEyeDropping) {
            const useCanvasEyeDropper = () => this.props.onActivateEyeDropper(paper.tool, this.props.onChangeColor);
            try {
                new window.EyeDropper().open()
                    .then(result => this.setColor(result.sRGBHex))
                    .catch(err => {
                        // AbortError means the user cancelled (e.g. pressed Escape)
                        if (!err || err.name !== 'AbortError') useCanvasEyeDropper();
                    });
            } catch (err) {
                useCanvasEyeDropper();
            }
            return;
        }
        this.props.onActivateEyeDropper(`
        ]
    ]);

    // ── color-indicator.jsx ──
    // Swapping gradient colors without a selection converted them to hex, dropping their opacity
    patchFile(colorIndicatorPath, 'color-indicator.jsx', [
        [
            `                color1 = color1 === null || color1 === MIXED ? color1 : parseColor(color1).hex;
                color2 = color2 === null || color2 === MIXED ? color2 : parseColor(color2).hex;
`,
            `                // pSVG: Colors may carry opacity, so swap them as-is instead of converting to hex
`
        ]
    ]);

    // ── color-button.jsx ──
    // Draw the Fill/Outline swatches over a checkerboard so their opacity is visible
    patchFile(colorButtonPath, 'color-button.jsx', [
        [
            `const ColorButtonComponent = props => (`,
            `// pSVG: Layer the swatch color over a checkerboard so semi-transparent colors read as such
const CHECKERBOARD = 'repeating-conic-gradient(#d9d9d9 0% 25%, #ffffff 0% 50%) 50% / 10px 10px';
const withCheckerboard = background => {
    if (!background || background === 'white') return background;
    const colorLayer = background.includes('gradient(') ? background : 'linear-gradient(' + background + ', ' + background + ')';
    return colorLayer + ', ' + CHECKERBOARD;
};

const ColorButtonComponent = props => (`
        ],
        [
            `                background: colorToBackground(props.color, props.color2, props.gradientType)`,
            `                background: withCheckerboard(colorToBackground(props.color, props.color2, props.gradientType))`
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

    // ── Copy Vetch icons into scratch-paint icons dirs ──
    const iconsToCopy = {
        [fixedToolsIconsDir]: ['expand-stroke.svg', 'union.svg', 'subtract.svg', 'midpoint.svg'],
        [modeToolsIconsDir]: ['cap-butt.svg', 'cap-round.svg', 'cap-square.svg'],
        [paintEditorIconsDir]: ['optimize.svg']
    };
    for (const [dir, icons] of Object.entries(iconsToCopy)) {
        for (const icon of icons) {
            const src = path.join(vetchIconsDir, icon);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, path.join(dir, icon));
            }
        }
    }
    console.log('[patch.js] Copied Vetch icons');

    // ── Copy boolean-tools.js helper into scratch-paint ──
    const boolSrc = path.resolve(__dirname, 'src/boolean-tools.js');
    const boolDst = path.join(basePath, 'helper/boolean-tools.js');
    if (fs.existsSync(boolSrc)) {
        fs.copyFileSync(boolSrc, boolDst);
    }
    console.log('[patch.js] Copied boolean-tools.js');

    // ── Copy point-tools.js helper (midpoint insertion) into scratch-paint ──
    const pointToolsSrc = path.resolve(__dirname, 'src/point-tools.js');
    const pointToolsDst = path.join(basePath, 'helper/point-tools.js');
    if (fs.existsSync(pointToolsSrc)) {
        fs.copyFileSync(pointToolsSrc, pointToolsDst);
    }
    console.log('[patch.js] Copied point-tools.js');

    // ── Copy rasterize.js helper (Rasterize to Bitmap) into scratch-paint ──
    const rasterizeSrc = path.resolve(__dirname, 'src/rasterize.js');
    if (fs.existsSync(rasterizeSrc)) {
        fs.copyFileSync(rasterizeSrc, path.join(basePath, 'helper/rasterize.js'));
    }
    console.log('[patch.js] Copied rasterize.js');

    // ── fixed-tools.jsx (container) ──
    // Add handlers for Expand Stroke, Union, Subtract and Midpoint
    patchFile(fixedToolsContainerPath, 'fixed-tools container', [
        // Add imports for boolean tools
        [
            `import {bringToFront, sendBackward, sendToBack, bringForward} from '../helper/order';`,
            `import {bringToFront, sendBackward, sendToBack, bringForward} from '../helper/order';
import {expandStroke, unionItems, subtractItems, canExpandStroke, canUnion, canSubtract} from '../helper/boolean-tools';
import {insertMidpoint} from '../helper/point-tools';`
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
            'handleSubtract',
            'handleMidpoint'
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
    handleMidpoint () {
        insertMidpoint(this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleSendBackward () {`
        ],
        // Pass new handlers as props in render
        [
            `                onUngroup={this.handleUngroup}`,
            `                onUngroup={this.handleUngroup}
                onExpandStroke={this.handleExpandStroke}
                onUnion={this.handleUnion}
                onSubtract={this.handleSubtract}
                onMidpoint={this.handleMidpoint}`
        ]
    ]);

    // ── fixed-tools.css ──
    // Dashed separator on the start side, used to set the boolean tools apart from Front/Back
    patchFile(fixedToolsCssPath, 'fixed-tools.css', [
        [
            `.mod-unselect {`,
            `[dir="ltr"] .mod-dashed-border-start {
    border-left: 1px dashed $ui-pane-border;
    padding-left: calc(2 * $grid-unit);
}

[dir="rtl"] .mod-dashed-border-start {
    border-right: 1px dashed $ui-pane-border;
    padding-right: calc(2 * $grid-unit);
}

.mod-unselect {`
        ]
    ]);

    // ── fixed-tools.jsx (component) ──
    // Remove the costume name field, and add boolean tool buttons (and Midpoint, in point selection mode)
    patchFile(fixedToolsComponentPath, 'fixed-tools component', [
        [
            `            {/* Name field */}
            <InputGroup>
                <MediaQuery minWidth={layout.fullSizeEditorMinWidth}>
                    <Label text={intl.formatMessage(messages.costume)}>
                        <BufferedInput
                            className={styles.costumeInput}
                            type="text"
                            value={props.name}
                            onSubmit={props.onUpdateName}
                        />
                    </Label>
                </MediaQuery>
                <MediaQuery maxWidth={layout.fullSizeEditorMinWidth - 1}>
                    <BufferedInput
                        className={styles.costumeInput}
                        type="text"
                        value={props.name}
                        onSubmit={props.onUpdateName}
                    />
                </MediaQuery>
            </InputGroup>
`,
            `            {/* pSVG: Costume name field removed (SVG files don't have a costume name) */}
`
        ],
        // Add icon imports
        [
            `import ungroupIcon from './icons/ungroup.svg';`,
            `import ungroupIcon from './icons/ungroup.svg';
import expandStrokeIcon from './icons/expand-stroke.svg';
import unionIcon from './icons/union.svg';
import subtractIcon from './icons/subtract.svg';
import midpointIcon from './icons/midpoint.svg';

import {canExpandStroke, canUnion, canSubtract} from '../../helper/boolean-tools';
import {canInsertMidpoint} from '../../helper/point-tools';
import Modes from '../../lib/modes';`
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
    },
    midpoint: {
        defaultMessage: 'Midpoint',
        description: 'Label for the button to add a point halfway between two selected points',
        id: 'paint.paintEditor.midpoint'
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
                    <InputGroup className={styles.modDashedBorderStart}>
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
                        {props.mode === Modes.RESHAPE && canInsertMidpoint() ?
                            <LabeledIconButton
                                hideLabel={hideLabel(intl.locale)}
                                imgSrc={midpointIcon}
                                title={intl.formatMessage(messages.midpoint)}
                                onClick={props.onMidpoint}
                            /> : null
                        }
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
    onSubtract: PropTypes.func.isRequired,
    onMidpoint: PropTypes.func.isRequired,
    mode: PropTypes.oneOf(Object.keys(Modes)),`
        ],
        // Re-render when the mode changes so Midpoint shows up only in point selection mode
        [
            `    rtl: state.scratchPaint.layout.rtl,
    selectedItems: state.scratchPaint.selectedItems,
    undoState: state.scratchPaint.undo`,
            `    mode: state.scratchPaint.mode,
    rtl: state.scratchPaint.layout.rtl,
    selectedItems: state.scratchPaint.selectedItems,
    undoState: state.scratchPaint.undo`
        ]
    ]);

    // ── Vetch theme ──
    // Replace Scratch's purple accent with Vetch violet. Filled accents (selected tool, Convert button,
    // focus rings) use a slightly deeper violet so white icons/text on them stay readable.
    patchFile(colorsCssPath, 'colors.css', [
        [
            '$looks-secondary: #855CD6;',
            '$looks-secondary: #C000E0; /* pSVG: Vetch violet */'
        ],
        [
            '$looks-transparent: hsla(260, 60%, 60%, 0.35); /* 35% transparent version of looks-secondary */',
            '$looks-transparent: rgba(220, 0, 255, 0.35); /* pSVG: 35% transparent Vetch violet */'
        ]
    ]);
    // Recolor every scratch-paint icon that uses the Scratch purple
    const recolorSvgs = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                recolorSvgs(fullPath);
            } else if (entry.name.endsWith('.svg')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const recolored = content.replace(SCRATCH_PURPLE, VETCH_VIOLET);
                if (recolored !== content) fs.writeFileSync(fullPath, recolored);
            }
        }
    };
    recolorSvgs(path.join(basePath, 'components'));
    console.log('[patch.js] Recolored icons to Vetch violet');

} catch (error) {
    console.error('[patch.js] Failed:', error);
}
