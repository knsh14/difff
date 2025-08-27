import * as vscode from 'vscode';

export interface FileDiff {
    path: string;
    content: string;
    additions: number;
    deletions: number;
}

export class DiffWebviewProvider {
    constructor(private readonly extensionUri: vscode.Uri) {}
    
    getWebviewContent(diffContent: string, fileName: string): string {
        const lines = diffContent.split('\n');
        const hunks = this.parseDiff(lines);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diff View</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .diff-header {
            padding: 16px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            margin-bottom: 16px;
        }
        
        .diff-header h2 {
            margin: 0 0 8px 0;
            font-size: 16px;
            font-weight: 600;
        }
        
        .diff-stats {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            font-size: 12px;
        }
        
        .additions {
            color: #3fb950;
        }
        
        .deletions {
            color: #f85149;
        }
        
        .diff-container {
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            overflow: hidden;
        }
        
        .diff-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 12px;
            line-height: 20px;
        }
        
        .diff-line {
            position: relative;
        }
        
        .diff-line-num {
            width: 1%;
            min-width: 50px;
            padding: 0 10px;
            text-align: right;
            color: var(--vscode-editorLineNumber-foreground);
            background: var(--vscode-editorGutter-background);
            user-select: none;
            border-right: 1px solid var(--vscode-editorWidget-border);
        }
        
        .diff-line-content {
            padding: 0 10px;
            white-space: pre;
            word-wrap: break-word;
        }
        
        .diff-line-addition {
            background: rgba(63, 185, 80, 0.15);
        }
        
        .diff-line-addition .diff-line-content::before {
            content: "+";
            position: absolute;
            left: 0;
            color: #3fb950;
        }
        
        .diff-line-deletion {
            background: rgba(248, 81, 73, 0.15);
        }
        
        .diff-line-deletion .diff-line-content::before {
            content: "-";
            position: absolute;
            left: 0;
            color: #f85149;
        }
        
        .diff-line-context {
            color: var(--vscode-editor-foreground);
        }
        
        .diff-hunk-header {
            background: var(--vscode-diffEditor-unchangedRegionBackground);
            color: var(--vscode-descriptionForeground);
            font-weight: bold;
            padding: 4px 10px;
        }
        
        .empty-diff {
            padding: 40px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="diff-header">
        <h2>${this.escapeHtml(fileName)}</h2>
        <div class="diff-stats">
            <span class="additions">+${this.countAdditions(hunks)} additions</span>
            <span class="deletions">-${this.countDeletions(hunks)} deletions</span>
        </div>
    </div>
    
    ${hunks.length > 0 ? this.renderDiff(hunks) : '<div class="empty-diff">No changes in this file</div>'}
</body>
</html>`;
    }
    
    private parseDiff(lines: string[]): any[] {
        const hunks = [];
        let currentHunk: any = null;
        let oldLineNum = 0;
        let newLineNum = 0;
        
        for (const line of lines) {
            if (line.startsWith('@@')) {
                if (currentHunk) {
                    hunks.push(currentHunk);
                }
                
                const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
                if (match) {
                    oldLineNum = parseInt(match[1]);
                    newLineNum = parseInt(match[2]);
                }
                
                currentHunk = {
                    header: line,
                    lines: []
                };
            } else if (currentHunk) {
                if (line.startsWith('+')) {
                    currentHunk.lines.push({
                        type: 'addition',
                        content: line.substring(1),
                        newLineNum: newLineNum++,
                        oldLineNum: ''
                    });
                } else if (line.startsWith('-')) {
                    currentHunk.lines.push({
                        type: 'deletion',
                        content: line.substring(1),
                        oldLineNum: oldLineNum++,
                        newLineNum: ''
                    });
                } else if (line.startsWith(' ') || line === '') {
                    currentHunk.lines.push({
                        type: 'context',
                        content: line.substring(1),
                        oldLineNum: oldLineNum++,
                        newLineNum: newLineNum++
                    });
                }
            }
        }
        
        if (currentHunk) {
            hunks.push(currentHunk);
        }
        
        return hunks;
    }
    
    private renderDiff(hunks: any[]): string {
        let html = '<div class="diff-container"><table class="diff-table"><tbody>';
        
        for (const hunk of hunks) {
            html += `<tr><td colspan="3" class="diff-hunk-header">${this.escapeHtml(hunk.header)}</td></tr>`;
            
            for (const line of hunk.lines) {
                const lineClass = `diff-line-${line.type}`;
                html += `
                    <tr class="diff-line ${lineClass}">
                        <td class="diff-line-num">${line.oldLineNum}</td>
                        <td class="diff-line-num">${line.newLineNum}</td>
                        <td class="diff-line-content">${this.escapeHtml(line.content)}</td>
                    </tr>
                `;
            }
        }
        
        html += '</tbody></table></div>';
        return html;
    }
    
    private countAdditions(hunks: any[]): number {
        let count = 0;
        for (const hunk of hunks) {
            count += hunk.lines.filter((l: any) => l.type === 'addition').length;
        }
        return count;
    }
    
    private countDeletions(hunks: any[]): number {
        let count = 0;
        for (const hunk of hunks) {
            count += hunk.lines.filter((l: any) => l.type === 'deletion').length;
        }
        return count;
    }
    
    private escapeHtml(text: string): string {
        const map: any = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    getAllDiffsContent(fileDiffs: FileDiff[], baseRef: string, compareRef: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All Diffs: ${baseRef} → ${compareRef}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .header {
            position: sticky;
            top: 0;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            padding: 16px 20px;
            z-index: 100;
        }
        
        .header h1 {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 600;
        }
        
        .header-stats {
            display: flex;
            gap: 20px;
            font-size: 14px;
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .additions {
            color: #3fb950;
        }
        
        .deletions {
            color: #f85149;
        }
        
        .file-nav {
            position: sticky;
            top: 73px;
            background: var(--vscode-editorWidget-background);
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            padding: 12px 20px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 99;
        }
        
        .file-nav-title {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
        }
        
        .file-link {
            display: block;
            padding: 4px 8px;
            margin: 2px 0;
            text-decoration: none;
            color: var(--vscode-textLink-foreground);
            border-radius: 4px;
            font-size: 13px;
            transition: background-color 0.2s;
        }
        
        .file-link:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .file-link .file-stats {
            float: right;
            font-size: 11px;
        }
        
        .content {
            padding: 20px;
        }
        
        .file-diff {
            margin-bottom: 32px;
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            overflow: hidden;
        }
        
        .file-header {
            padding: 12px 16px;
            background: var(--vscode-editorWidget-background);
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .file-header h2 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        }
        
        .file-stats {
            display: flex;
            gap: 12px;
            font-size: 12px;
        }
        
        .diff-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 12px;
            line-height: 20px;
        }
        
        .diff-line {
            position: relative;
        }
        
        .diff-line-num {
            width: 1%;
            min-width: 50px;
            padding: 0 10px;
            text-align: right;
            color: var(--vscode-editorLineNumber-foreground);
            background: var(--vscode-editorGutter-background);
            user-select: none;
            border-right: 1px solid var(--vscode-editorWidget-border);
        }
        
        .diff-line-content {
            padding: 0 10px;
            white-space: pre;
            word-wrap: break-word;
        }
        
        .diff-line-addition {
            background: rgba(63, 185, 80, 0.15);
        }
        
        .diff-line-addition .diff-line-content::before {
            content: "+";
            position: absolute;
            left: 0;
            color: #3fb950;
        }
        
        .diff-line-deletion {
            background: rgba(248, 81, 73, 0.15);
        }
        
        .diff-line-deletion .diff-line-content::before {
            content: "-";
            position: absolute;
            left: 0;
            color: #f85149;
        }
        
        .diff-line-context {
            color: var(--vscode-editor-foreground);
        }
        
        .diff-hunk-header {
            background: var(--vscode-diffEditor-unchangedRegionBackground);
            color: var(--vscode-descriptionForeground);
            font-weight: bold;
            padding: 4px 10px;
        }
        
        .empty-diff {
            padding: 40px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
        
        .no-changes {
            padding: 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-editorWidget-background);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Comparing ${this.escapeHtml(baseRef)} → ${this.escapeHtml(compareRef)}</h1>
        <div class="header-stats">
            <div class="stat-item">
                <span>${fileDiffs.length} files changed</span>
            </div>
            <div class="stat-item additions">
                <span>+${fileDiffs.reduce((sum, f) => sum + f.additions, 0)} additions</span>
            </div>
            <div class="stat-item deletions">
                <span>-${fileDiffs.reduce((sum, f) => sum + f.deletions, 0)} deletions</span>
            </div>
        </div>
    </div>
    
    ${fileDiffs.length > 3 ? `
    <div class="file-nav">
        <div class="file-nav-title">Files Changed</div>
        ${fileDiffs.map(file => `
            <a href="#file-${this.escapeHtml(file.path.replace(/[^a-zA-Z0-9]/g, '-'))}" class="file-link">
                ${this.escapeHtml(file.path)}
                <span class="file-stats">
                    <span class="additions">+${file.additions}</span>
                    <span class="deletions">-${file.deletions}</span>
                </span>
            </a>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="content">
        ${fileDiffs.length === 0 ? 
            '<div class="empty-diff">No changes found between these branches</div>' :
            fileDiffs.map(file => this.renderFileDiff(file)).join('')
        }
    </div>
    
    <script>
        // Smooth scroll for navigation links
        document.querySelectorAll('.file-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    </script>
</body>
</html>`;
    }
    
    private renderFileDiff(file: FileDiff): string {
        const lines = file.content.split('\n');
        const hunks = this.parseDiff(lines);
        const fileId = file.path.replace(/[^a-zA-Z0-9]/g, '-');
        
        return `
        <div class="file-diff" id="file-${this.escapeHtml(fileId)}">
            <div class="file-header">
                <h2>${this.escapeHtml(file.path)}</h2>
                <div class="file-stats">
                    <span class="additions">+${file.additions}</span>
                    <span class="deletions">-${file.deletions}</span>
                </div>
            </div>
            ${hunks.length > 0 ? 
                `<table class="diff-table"><tbody>${this.renderHunks(hunks)}</tbody></table>` :
                '<div class="no-changes">No changes in this file</div>'
            }
        </div>`;
    }
    
    private renderHunks(hunks: any[]): string {
        let html = '';
        
        for (const hunk of hunks) {
            html += `<tr><td colspan="3" class="diff-hunk-header">${this.escapeHtml(hunk.header)}</td></tr>`;
            
            for (const line of hunk.lines) {
                const lineClass = `diff-line-${line.type}`;
                html += `
                    <tr class="diff-line ${lineClass}">
                        <td class="diff-line-num">${line.oldLineNum}</td>
                        <td class="diff-line-num">${line.newLineNum}</td>
                        <td class="diff-line-content">${this.escapeHtml(line.content)}</td>
                    </tr>
                `;
            }
        }
        
        return html;
    }
}