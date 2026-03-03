import * as vscode from 'vscode';

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

    constructor(private readonly context: vscode.ExtensionContext) { }

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

        // Send the initial SVG data to the React app
        const updateWebview = () => {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        };

        // Wait a brief moment for React to mount, then send the data
        setTimeout(updateWebview, 500);

        // Listen for changes to the file (like undo/redo)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Listen for edits coming FROM the React app
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'edit':
                    this.updateTextDocument(document, e.newSvgData);
                    return;
            }
        });
    }

    // Helper to replace the file contents
    private updateTextDocument(document: vscode.TextDocument, newContent: string) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
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

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Scratch SVG Editor</title>
                <style>
                    body, html { margin: 0; padding: 0; height: 100vh; overflow: hidden; background-color: #fff; }
                </style>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}