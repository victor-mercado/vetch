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

function patchFile(filePath, label, replacements) {
    if (!fs.existsSync(filePath)) {
        console.warn(`[patch.js] SKIP: ${filePath} not found`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        if (typeof search === 'string') {
            if (content.includes(search)) {
                content = content.split(search).join(replace);
            }
        } else {
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

} catch (error) {
    console.error('[patch.js] Failed:', error);
}
