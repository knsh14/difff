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

export type TreeNode = BranchSelector | DiffFile;

export class DiffExplorerProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = this._onDidChangeTreeData.event;
    
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
    
    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!element) {
            // Root level - only show branch selectors
            const nodes: TreeNode[] = [
                new BranchSelector('Base', 'base', this.baseRef),
                new BranchSelector('Compare', 'compare', this.compareRef)
            ];
            
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