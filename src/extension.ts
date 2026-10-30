import * as vscode from 'vscode';
import type { Config } from 'svgo' with { 'resolution-mode': 'import' };

// SVGO is an ES module that also ships a CommonJS build, which require() loads
const { optimize } = require('svgo') as typeof import('svgo', { with: { 'resolution-mode': 'import' } });

// Settings shared by every Vetch editor and their defaults. `camera` is where the last active editor's
// view was; `editorState` is its tool, colors and sizes.
const SHARED_SETTINGS: Record<string, unknown> = {
    snapOn: true,
    isDarkMode: false,
    camera: null,
    editorState: null
};
// Settings that are passed on to the other open editors as soon as they change
const LIVE_SETTINGS = new Set(['snapOn', 'isDarkMode', 'editorState']);

// Vetch keeps the image's origin (its rotation center in Scratch) in a comment after </svg>
const ROTATION_CENTER = /<!--rotationCenter:-?[\d.]+:-?[\d.]+-->/;

// "Optimize and Save SVG": SVGO's default optimizations, which don't change how the image looks, plus
// removing the extra data the editor writes on every export
const SVGO_CONFIG: Config = {
    multipass: true,
    plugins: [
        // Also remove the editor's data-paper-data attributes
        { name: 'preset-default', params: { overrides: { removeUnknownsAndDefaults: { keepDataAttrs: false } } } },
        {
            // mix-blend-mode: normal is the default, but the editor writes it on its layer group
            name: 'removeNormalBlendMode',
            fn: () => ({
                element: {
                    enter: node => {
                        if (!node.attributes.style) {
                            return;
                        }
                        const declarations = node.attributes.style.split(';').map(declaration => declaration.trim())
                            .filter(declaration => declaration && !/^mix-blend-mode\s*:\s*normal$/i.test(declaration));
                        if (declarations.length > 0) {
                            node.attributes.style = declarations.join(';');
                        } else {
                            delete node.attributes.style;
                        }
                    }
                }
            })
        }
    ]
};

function optimizeSvg(svg: string): string {
    const rotationCenter = svg.match(ROTATION_CENTER)?.[0] ?? '';
    return optimize(svg.replace(ROTATION_CENTER, '').trim(), SVGO_CONFIG).data + rotationCenter;
}

function formatSize(text: string): string {
    return `${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB`;
}

export function activate(context: vscode.ExtensionContext) {
    // Register our custom editor provider
    context.subscriptions.push(ScratchEditorProvider.register(context));
}

class ScratchEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ScratchEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(ScratchEditorProvider.viewType, provider);
    }

    private static readonly viewType = 'scratchSvgEditor.paint';

    // Webviews of all open Vetch editors
    private readonly webviews = new Set<vscode.Webview>();

    // Current shared settings. Kept in memory and saved to global state as a single object: saving
    // separate keys in quick succession (the camera is saved several times a second while panning)
    // could lose some of the updates.
    private readonly settings: Record<string, unknown>;

    constructor(private readonly context: vscode.ExtensionContext) {
        const state = context.globalState;
        // Settings saved by Vetch 1.0 under separate keys
        const legacyCamera = [state.get('vetch.cameraZoom'), state.get('vetch.cameraX'), state.get('vetch.cameraY')];
        const legacy: Record<string, unknown> = {
            snapOn: state.get('vetch.snapOn', SHARED_SETTINGS.snapOn),
            isDarkMode: state.get('vetch.isDarkMode', SHARED_SETTINGS.isDarkMode),
            camera: legacyCamera.every(value => typeof value === 'number') ?
                { zoom: legacyCamera[0], x: legacyCamera[1], y: legacyCamera[2] } : null
        };
        this.settings = { ...SHARED_SETTINGS, ...legacy, ...state.get<Record<string, unknown>>('vetch.settings', {}) };
    }

    private getSettings(): Record<string, unknown> {
        return { ...this.settings };
    }

    private saveSetting(name: string, value: unknown) {
        this.settings[name] = value;
        this.context.globalState.update('vetch.settings', this.settings);
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Send the SVG data to the React app
        const updateWebview = () => {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        };

        let isUpdatingFromWebview = false;

        // Change the document one request at a time, so an optimization never works on text that an
        // edit is still replacing
        let documentQueue: Promise<unknown> = Promise.resolve();
        const queueDocumentChange = (change: () => Promise<unknown>) => {
            documentQueue = documentQueue.then(change, change);
            return documentQueue;
        };

        // Listen for changes to the file (like undo/redo)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            // Saving fires a change with no content changes (only the dirty state changed); nothing to reload
            if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) {
                if (isUpdatingFromWebview) return;
                updateWebview();
            }
        });

        this.webviews.add(webviewPanel.webview);

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            this.webviews.delete(webviewPanel.webview);
        });

        // Listen for messages coming FROM the React app
        webviewPanel.webview.onDidReceiveMessage(async e => {
            switch (e.type) {
                case 'ready':
                    // VS Code reloads a webview whenever its tab is shown again, so always send the
                    // latest shared settings rather than relying on the ones embedded in the page
                    webviewPanel.webview.postMessage({ type: 'settings', settings: this.getSettings() });
                    updateWebview();
                    return;
                case 'saveSetting':
                    if (!Object.prototype.hasOwnProperty.call(SHARED_SETTINGS, e.setting)) {
                        return;
                    }
                    this.saveSetting(e.setting, e.value);
                    if (LIVE_SETTINGS.has(e.setting)) {
                        for (const webview of this.webviews) {
                            if (webview !== webviewPanel.webview) {
                                webview.postMessage({ type: 'settings', settings: { [e.setting]: e.value } });
                            }
                        }
                    }
                    return;
                case 'edit':
                    await queueDocumentChange(async () => {
                        isUpdatingFromWebview = true;
                        try {
                            await this.updateTextDocument(document, e.newSvgData);
                        } finally {
                            isUpdatingFromWebview = false;
                        }
                    });
                    return;
                case 'optimize':
                    await queueDocumentChange(async () => {
                        const text = document.getText();
                        let optimized: string;
                        try {
                            optimized = optimizeSvg(text);
                        } catch (err) {
                            vscode.window.showErrorMessage(`Vetch couldn't optimize this SVG: ${err instanceof Error ? err.message : err}`);
                            return;
                        }
                        // The editor already shows this image, so don't send it back to be reloaded
                        isUpdatingFromWebview = true;
                        try {
                            await this.updateTextDocument(document, optimized);
                        } finally {
                            isUpdatingFromWebview = false;
                        }
                        await document.save();
                        vscode.window.setStatusBarMessage(`Vetch: optimized SVG from ${formatSize(text)} to ${formatSize(optimized)}`, 5000);
                    });
                    return;
            }
        });
    }

    // Helper to replace the file contents
    private updateTextDocument(document: vscode.TextDocument, newContent: string) {
        if (document.getText() === newContent) {
            return Promise.resolve(false);
        }
        const edit = new vscode.WorkspaceEdit();

        // Robust way to replace the entire document spanning all lines safely
        const lastLine = document.lineAt(document.lineCount - 1);
        const endPosition = lastLine.range.end;

        edit.replace(
            document.uri,
            new vscode.Range(new vscode.Position(0, 0), endPosition),
            newContent
        );
        return vscode.workspace.applyEdit(edit);
    }

    // Generate the HTML that loads our Vite build
    // Generate the HTML that loads our Vite build
    // Generate the HTML that loads our Vite build
    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'assets', 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'assets', 'index.css'));
        // Escape "<" so stored values can't close the script tag
        const settingsJson = JSON.stringify(this.getSettings()).replace(/</g, '\\u003c');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Scratch SVG Editor</title>
                <style>
                    body, html { margin: 0; padding: 0; height: 100vh; overflow: hidden; background-color: #1e1e1e; }
                </style>
                <script>
                    window.vetchSettings = ${settingsJson};
                </script>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}