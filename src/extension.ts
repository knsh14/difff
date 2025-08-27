import * as vscode from 'vscode';
import { DiffExplorerProvider, DiffFile, BranchSelector, ModeSelector } from './diffExplorer';
import { GitService } from './gitService';
import { DiffWebviewProvider, FileDiff } from './webviewProvider';

export function activate(context: vscode.ExtensionContext) {
    // Check if we're in a git repository
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return;
    }
    
    let gitService: GitService;
    try {
        gitService = new GitService();
    } catch (error) {
        vscode.window.showErrorMessage('Failed to initialize Git service. Make sure you have a git repository.');
        return;
    }
    
    const diffExplorerProvider = new DiffExplorerProvider(gitService);
    const diffWebviewProvider = new DiffWebviewProvider(context.extensionUri);

    vscode.window.registerTreeDataProvider('difff.explorer', diffExplorerProvider);
    
    const selectModeCommand = vscode.commands.registerCommand('difff.selectMode', async (mode: 'branch' | 'working') => {
        diffExplorerProvider.setMode(mode);
        
        // If switching to working mode, auto-open diff view
        if (mode === 'working') {
            vscode.commands.executeCommand('difff.viewDiff');
        }
    });
    
    const selectBranchesCommand = vscode.commands.registerCommand('difff.selectBranches', async (type?: 'base' | 'compare') => {
        try {
            const refs = await gitService.getAllRefs();
            
            if (!refs || refs.length === 0) {
                vscode.window.showErrorMessage('No git references found. Make sure you have a git repository with commits.');
                return;
            }
            
            if (type === 'base' || !type) {
                const baseRef = await vscode.window.showQuickPick(refs, {
                    placeHolder: 'Select base branch/tag/commit (compare from)'
                });
                
                if (!baseRef) return;
                
                if (!type) {
                    const compareRef = await vscode.window.showQuickPick(refs, {
                        placeHolder: 'Select compare branch/tag/commit (compare to)'
                    });
                    
                    if (!compareRef) return;
                    const bothSelected = await diffExplorerProvider.setRefs(baseRef, compareRef);
                    if (bothSelected) {
                        // Auto-open diff view when both branches are selected
                        vscode.commands.executeCommand('difff.viewDiff');
                    }
                } else {
                    const currentCompare = diffExplorerProvider.getCompareRef();
                    if (currentCompare) {
                        const bothSelected = await diffExplorerProvider.setRefs(baseRef, currentCompare);
                        if (bothSelected) {
                            vscode.commands.executeCommand('difff.viewDiff');
                        }
                    } else {
                        await diffExplorerProvider.setRefs(baseRef, '');
                    }
                }
            } else if (type === 'compare') {
                const currentBase = diffExplorerProvider.getBaseRef();
                if (!currentBase) {
                    vscode.window.showInformationMessage('Please select a base branch first');
                    return;
                }
                
                const compareRef = await vscode.window.showQuickPick(refs, {
                    placeHolder: 'Select compare branch/tag/commit (compare to)'
                });
                
                if (!compareRef) return;
                const bothSelected = await diffExplorerProvider.setRefs(currentBase, compareRef);
                if (bothSelected) {
                    vscode.commands.executeCommand('difff.viewDiff');
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error selecting branches: ${error.message}`);
        }
    });
    
    const refreshCommand = vscode.commands.registerCommand('difff.refresh', () => {
        // Refresh the tree view
        diffExplorerProvider.refresh();
        
        // If ready for diff, also refresh the diff view
        if (diffExplorerProvider.isReadyForDiff()) {
            vscode.commands.executeCommand('difff.viewDiff');
        }
    });
    
    const openFileCommand = vscode.commands.registerCommand('difff.openFile', async (file: DiffFile) => {
        if (!file) return;
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;
        
        const baseRef = diffExplorerProvider.getBaseRef();
        const compareRef = diffExplorerProvider.getCompareRef();
        
        if (!baseRef || !compareRef) {
            vscode.window.showErrorMessage('Please select branches to compare first');
            return;
        }
        
        try {
            // Try to use webview first for GitHub-like display
            const panel = vscode.window.createWebviewPanel(
                'difff.diffView',
                `Diff: ${file.path}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            
            const diffContent = await gitService.getFileDiff(baseRef, compareRef, file.path);
            panel.webview.html = diffWebviewProvider.getWebviewContent(diffContent, file.path);
        } catch (error) {
            // Fallback to native VS Code diff
            try {
                const baseUri = vscode.Uri.parse(`git:${file.path}?${baseRef}`);
                const compareUri = vscode.Uri.parse(`git:${file.path}?${compareRef}`);
                const title = `${file.path}: ${baseRef} ↔ ${compareRef}`;
                await vscode.commands.executeCommand('vscode.diff', baseUri, compareUri, title);
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to open diff: ${err}`);
            }
        }
    });
    
    const viewDiffCommand = vscode.commands.registerCommand('difff.viewDiff', async () => {
        const mode = diffExplorerProvider.getMode();
        
        // Show loading message
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: mode === 'working' ? "Loading working directory changes..." : "Loading branch diffs...",
            cancellable: false
        }, async (progress) => {
            try {
                let diffFiles: any[] = [];
                let fileDiffs: FileDiff[] = [];
                let title = '';
                
                if (mode === 'working') {
                    // Working directory mode
                    title = 'Working Directory Changes';
                    diffFiles = await gitService.getWorkingDirectoryFiles();
                    
                    for (let i = 0; i < diffFiles.length; i++) {
                        const file = diffFiles[i];
                        progress.report({ 
                            increment: (100 / diffFiles.length),
                            message: `Processing ${file.path}...`
                        });
                        
                        const content = await gitService.getWorkingDirectoryFileDiff(file.path);
                        fileDiffs.push({
                            path: file.path,
                            content: content,
                            additions: file.additions,
                            deletions: file.deletions
                        });
                    }
                } else {
                    // Branch comparison mode
                    const baseRef = diffExplorerProvider.getBaseRef();
                    const compareRef = diffExplorerProvider.getCompareRef();
                    
                    if (!baseRef || !compareRef) {
                        vscode.window.showErrorMessage('Please select branches to compare first');
                        return;
                    }
                    
                    title = `${baseRef} → ${compareRef}`;
                    diffFiles = await gitService.getDiffFiles(baseRef, compareRef);
                    
                    for (let i = 0; i < diffFiles.length; i++) {
                        const file = diffFiles[i];
                        progress.report({ 
                            increment: (100 / diffFiles.length),
                            message: `Processing ${file.path}...`
                        });
                        
                        const content = await gitService.getFileDiff(baseRef, compareRef, file.path);
                        fileDiffs.push({
                            path: file.path,
                            content: content,
                            additions: file.additions,
                            deletions: file.deletions
                        });
                    }
                }
                
                // Create webview panel
                const panel = vscode.window.createWebviewPanel(
                    'difff.diffView',
                    `Diff: ${title}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );
                
                // Set up message handling for reload button
                panel.webview.onDidReceiveMessage(
                    message => {
                        if (message.command === 'reload') {
                            // Refresh the diff view
                            vscode.commands.executeCommand('difff.viewDiff');
                            
                            // Send reload complete message back to webview
                            setTimeout(() => {
                                panel.webview.postMessage({ command: 'reloadComplete' });
                            }, 100);
                        }
                    },
                    undefined,
                    context.subscriptions
                );
                
                // Set webview content
                if (mode === 'working') {
                    panel.webview.html = diffWebviewProvider.getWorkingDirectoryContent(fileDiffs);
                } else {
                    const baseRef = diffExplorerProvider.getBaseRef();
                    const compareRef = diffExplorerProvider.getCompareRef();
                    panel.webview.html = diffWebviewProvider.getAllDiffsContent(fileDiffs, baseRef, compareRef);
                }
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to load diffs: ${error.message}`);
            }
        });
    });
    
    context.subscriptions.push(selectModeCommand, selectBranchesCommand, refreshCommand, openFileCommand, viewDiffCommand);
}

export function deactivate() {}