import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './gitService';

export class DiffFile extends vscode.TreeItem {
    constructor(
        public readonly path: string,
        public readonly status: string,
        public readonly additions: number,
        public readonly deletions: number
    ) {
        super(path, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `${this.path}\n+${this.additions} -${this.deletions}`;
        this.description = `+${this.additions} -${this.deletions}`;
        this.contextValue = 'diffFile';
        
        this.iconPath = this.getIcon();
        this.command = {
            command: 'difff.openFile',
            title: 'Open Diff',
            arguments: [this]
        };
    }
    
    private getIcon(): vscode.ThemeIcon {
        switch (this.status) {
            case 'added':
                return new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
            case 'deleted':
                return new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
            case 'modified':
                return new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
            default:
                return new vscode.ThemeIcon('file');
        }
    }
}

export class ModeSelector extends vscode.TreeItem {
    constructor(
        public readonly mode: 'branch' | 'working',
        public readonly isActive: boolean
    ) {
        const label = mode === 'branch' ? 'Branch Comparison' : 'Working Directory Changes';
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = isActive ? '(Active)' : '';
        this.contextValue = 'modeSelector';
        this.iconPath = new vscode.ThemeIcon(mode === 'branch' ? 'git-compare' : 'git-commit');
        this.command = {
            command: 'difff.selectMode',
            title: 'Select Mode',
            arguments: [mode]
        };
    }
}

export class BranchSelector extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: 'base' | 'compare',
        public readonly selectedRef?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = selectedRef || 'Click to select';
        this.contextValue = 'branchSelector';
        this.iconPath = new vscode.ThemeIcon('git-branch');
        this.command = {
            command: 'difff.selectBranches',
            title: 'Select Branch',
            arguments: [type]
        };
    }
}

export type TreeNode = ModeSelector | BranchSelector | DiffFile;

export class DiffExplorerProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private mode: 'branch' | 'working' = 'branch';
    private baseRef: string = '';
    private compareRef: string = '';
    private diffFiles: DiffFile[] = [];
    
    constructor(private gitService: GitService) {}
    
    refresh(): void {
        this.loadDiffFiles();
        this._onDidChangeTreeData.fire();
    }
    
    async setRefs(baseRef: string, compareRef: string): Promise<boolean> {
        this.baseRef = baseRef;
        this.compareRef = compareRef;
        this._onDidChangeTreeData.fire();
        // Return true if both refs are set
        return !!(this.baseRef && this.compareRef);
    }
    
    getBaseRef(): string {
        return this.baseRef;
    }
    
    getCompareRef(): string {
        return this.compareRef;
    }
    
    getMode(): 'branch' | 'working' {
        return this.mode;
    }
    
    setMode(mode: 'branch' | 'working') {
        this.mode = mode;
        this._onDidChangeTreeData.fire();
    }
    
    isReadyForDiff(): boolean {
        if (this.mode === 'working') {
            return true; // Working directory mode is always ready
        }
        return !!(this.baseRef && this.compareRef); // Branch mode needs both refs
    }
    
    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!element) {
            const nodes: TreeNode[] = [];
            
            // Mode selectors
            nodes.push(new ModeSelector('branch', this.mode === 'branch'));
            nodes.push(new ModeSelector('working', this.mode === 'working'));
            
            // Branch selectors (only show in branch mode)
            if (this.mode === 'branch') {
                nodes.push(new BranchSelector('Base', 'base', this.baseRef));
                nodes.push(new BranchSelector('Compare', 'compare', this.compareRef));
            }
            
            return nodes;
        }
        
        return [];
    }
    
    private async loadDiffFiles() {
        if (!this.baseRef || !this.compareRef) {
            this.diffFiles = [];
            return;
        }
        
        try {
            const files = await this.gitService.getDiffFiles(this.baseRef, this.compareRef);
            this.diffFiles = files.map(file => 
                new DiffFile(file.path, file.status, file.additions, file.deletions)
            );
        } catch (error) {
            console.error('Error loading diff files:', error);
            this.diffFiles = [];
        }
    }
}