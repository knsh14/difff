import * as vscode from "vscode";
import { DiffComment } from "./commentService";

export interface FileDiff {
  path: string;
  content: string;
  additions: number;
  deletions: number;
}

export class DiffWebviewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  getWebviewContent(diffContent: string, fileName: string): string {
    const lines = diffContent.split("\n");
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
      if (line.startsWith("@@")) {
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
          lines: [],
        };
      } else if (currentHunk) {
        if (line.startsWith("+")) {
          currentHunk.lines.push({
            type: "addition",
            content: line.substring(1),
            newLineNum: newLineNum++,
            oldLineNum: "",
          });
        } else if (line.startsWith("-")) {
          currentHunk.lines.push({
            type: "deletion",
            content: line.substring(1),
            oldLineNum: oldLineNum++,
            newLineNum: "",
          });
        } else if (line.startsWith(" ") || line === "") {
          currentHunk.lines.push({
            type: "context",
            content: line.substring(1),
            oldLineNum: oldLineNum++,
            newLineNum: newLineNum++,
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

    html += "</tbody></table></div>";
    return html;
  }

  private countAdditions(hunks: any[]): number {
    let count = 0;
    for (const hunk of hunks) {
      count += hunk.lines.filter((l: any) => l.type === "addition").length;
    }
    return count;
  }

  private countDeletions(hunks: any[]): number {
    let count = 0;
    for (const hunk of hunks) {
      count += hunk.lines.filter((l: any) => l.type === "deletion").length;
    }
    return count;
  }

  private escapeHtml(text: string): string {
    const map: any = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  getAllDiffsContent(
    fileDiffs: FileDiff[],
    baseRef?: string,
    compareRef?: string,
    comments: Map<string, DiffComment[]> = new Map(),
    currentUser?: string,
  ): string {
    const allFilesHtml = fileDiffs
      .map((file) =>
        this.renderFileDiff(
          file,
          comments.get(file.path) || [],
          baseRef,
          compareRef,
        ),
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diff View</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }

        .header {
            position: sticky;
            top: 0;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
        }

        .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }

        .header-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .reload-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }

        .reload-btn:hover:not(.loading) {
            background-color: var(--vscode-button-hoverBackground);
        }

        .reload-btn.loading {
            cursor: not-allowed;
            opacity: 0.7;
        }

        .reload-btn.loading span:first-child {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .copy-comments-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }

        .copy-comments-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .file-diff {
            margin: 0 16px 24px 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
        }

        .file-header {
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            padding: 8px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .file-header h2 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
        }

        .file-header-title {
            cursor: pointer;
            transition: color 0.2s;
        }

        .file-header-title:hover {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
        }

        .file-stats {
            display: flex;
            gap: 8px;
            font-size: 12px;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
        }

        .additions {
            color: var(--vscode-gitDecoration-addedResourceForeground);
        }

        .deletions {
            color: var(--vscode-gitDecoration-deletedResourceForeground);
        }

        .diff-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
        }

        .diff-hunk-header {
            background-color: var(--vscode-diffEditor-unchangedRegionBackground);
            color: var(--vscode-diffEditor-unchangedRegionForeground);
            padding: 4px 8px;
            border-top: 1px solid var(--vscode-panel-border);
            font-weight: 600;
        }

        .diff-line {
            position: relative;
        }

        .diff-line:hover .add-comment-button {
            opacity: 1;
        }

        .diff-line-num {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editorLineNumber-foreground);
            padding: 0;
            text-align: right;
            vertical-align: top;
            width: 50px;
            min-width: 50px;
            border-right: 1px solid var(--vscode-panel-border);
            user-select: none;
            position: relative;
        }

        .diff-line-wrapper {
            position: relative;
            padding: 2px 8px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            min-height: 22px;
        }

        .add-comment-button {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s, background-color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
        }
        
        /* Show a visual indicator on hover */
        .add-comment-button::before {
            content: '+';
            background-color: var(--vscode-button-background);
            border-radius: 3px;
            width: 18px;
            height: 18px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: 4px;
        }

        .add-comment-button:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .add-comment-button:hover::before {
            background-color: var(--vscode-button-hoverBackground);
        }

        .diff-line-content {
            padding: 2px 8px;
            white-space: pre;
            overflow: visible;
            word-wrap: break-word;
        }

        .diff-line-addition {
            background-color: var(--vscode-diffEditor-insertedLineBackground, #1e4f32);
        }

        .diff-line-addition .diff-line-content {
            background-color: var(--vscode-diffEditor-insertedTextBackground, rgba(46, 160, 67, 0.25));
        }

        .diff-line-deletion {
            background-color: var(--vscode-diffEditor-removedLineBackground, #4f1e1e);
        }

        .diff-line-deletion .diff-line-content {
            background-color: var(--vscode-diffEditor-removedTextBackground, rgba(248, 81, 73, 0.25));
        }

        .diff-line-context {
            background-color: var(--vscode-editor-background);
        }

        .no-changes {
            padding: 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .comment-thread-row {
            background-color: var(--vscode-editor-background);
        }

        .comment-thread-container {
            border-left: 3px solid var(--vscode-button-background);
            margin-left: 8px;
            padding-left: 8px;
        }

        .comment-thread-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 0;
            cursor: pointer;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            font-weight: 500;
        }

        .comment-thread-header:hover {
            color: var(--vscode-foreground);
        }

        .comment-thread-toggle {
            transition: transform 0.2s;
            font-size: 10px;
        }

        .comment-thread-collapsed .comment-thread-toggle {
            transform: rotate(-90deg);
        }

        .comment-thread-collapsed .comment-thread-body {
            display: none;
        }

        .comment-thread-body {
            padding-bottom: 8px;
        }

        .comment-item {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
            padding: 12px;
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
        }

        .comment-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .comment-body {
            flex: 1;
            min-width: 0;
        }

        .comment-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }

        .comment-author {
            font-weight: 600;
            font-size: 13px;
        }

        .comment-timestamp {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .comment-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.4;
            font-size: 13px;
            margin-bottom: 8px;
        }

        .comment-actions-menu {
            display: flex;
            gap: 4px;
        }

        .comment-action-btn {
            background: transparent;
            border: none;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            font-size: 11px;
            padding: 4px 6px;
            border-radius: 3px;
            transition: background-color 0.2s, color 0.2s;
        }

        .comment-action-btn:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
            color: var(--vscode-foreground);
        }

        .comment-form-row {
            background-color: var(--vscode-editor-background);
        }

        .comment-form-container {
            border-left: 3px solid var(--vscode-button-background);
            margin-left: 8px;
            padding-left: 8px;
        }

        .comment-form {
            display: flex;
            gap: 12px;
            padding: 12px;
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            margin: 8px 0;
        }

        .comment-form-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .comment-form-body {
            flex: 1;
        }

        .comment-textarea {
            width: 100%;
            min-height: 100px;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
            margin-bottom: 8px;
        }

        .comment-textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        .comment-form-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        .comment-submit-btn {
            padding: 6px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
        }

        .comment-submit-btn:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }

        .comment-submit-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .comment-cancel-btn {
            padding: 6px 12px;
            background-color: transparent;
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        .comment-cancel-btn:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .comment-cancel-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Deletion animation */
        .comment-item.deleting {
            opacity: 0.5;
            transform: scale(0.95);
            transition: opacity 0.3s, transform 0.3s;
            pointer-events: none;
        }

        .comment-item.deleted {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Diff: ${this.escapeHtml(baseRef || "")} → ${this.escapeHtml(compareRef || "")}</h1>
        <div class="header-actions">
            <button class="copy-comments-btn" onclick="copyAllComments()">
                <span>📋</span>
                <span>Copy All Comments</span>
            </button>
            <button class="reload-btn" id="reload-diff-btn" onclick="reloadDiff()">
                <span>↻</span>
                <span>Reload</span>
            </button>
        </div>
    </div>

    <div class="content">
        ${allFilesHtml}
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function reloadDiff() {
            const reloadBtn = document.getElementById('reload-diff-btn');
            if (reloadBtn.classList.contains('loading')) {
                return; // Prevent multiple clicks while loading
            }
            
            reloadBtn.classList.add('loading');
            reloadBtn.innerHTML = '<span>↻</span><span>Reloading...</span>';
            vscode.postMessage({ command: 'reload' });
        }

        function copyAllComments() {
            vscode.postMessage({ command: 'copyComments' });
        }

        // Initialize event listeners
        function initializeEventListeners() {
            // Add event listener for file links in navigation
            document.querySelectorAll('.file-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    // Allow default scroll behavior but also open file
                    const filePath = link.dataset.filePath;
                    if (filePath) {
                        vscode.postMessage({ command: 'openFile', filePath: filePath });
                    }
                });
            });

            // Add event listener for file headers
            document.querySelectorAll('.file-header-title').forEach(header => {
                header.addEventListener('click', (e) => {
                    const filePath = header.dataset.filePath;
                    if (filePath) {
                        vscode.postMessage({ command: 'openFile', filePath: filePath });
                    }
                });
            });
        }

        // Set up event listeners when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeEventListeners);
        } else {
            initializeEventListeners();
        }
        
        // Set current user info from extension
        const currentUserName = ${JSON.stringify(currentUser || "User")};
        let currentCommentThreadId = null;
        
        function getCurrentUserInitials() {
            return currentUserName
                .split(' ')
                .map(name => name.charAt(0).toUpperCase())
                .join('')
                .substring(0, 2);
        }
        
        function showCommentForm(filePath, lineNumber, lineType) {
            // Remove any existing form
            hideCommentForm();
            
            const targetRow = document.querySelector(\`tr[data-line-num="\${lineNumber}"][data-line-type="\${lineType}"]\`);
            if (!targetRow) {
                return;
            }
            
            const threadId = \`\${filePath}-\${lineNumber}-\${lineType}\`;
            currentCommentThreadId = threadId;
            
            const formRow = document.createElement('tr');
            formRow.classList.add('comment-form-row');
            formRow.innerHTML = \`
                <td colspan="3">
                    <div class="comment-form-container">
                        <div class="comment-form">
                            <div class="comment-form-avatar">\${getCurrentUserInitials()}</div>
                            <div class="comment-form-body">
                                <textarea class="comment-textarea" placeholder="Leave a comment" data-thread-id="\${threadId}"></textarea>
                                <div class="comment-form-actions">
                                    <button class="comment-cancel-btn" data-cancel-comment>Cancel</button>
                                    <button class="comment-submit-btn" data-submit-comment data-file-path="\${filePath}" data-line-number="\${lineNumber}" data-line-type="\${lineType}">Comment</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            \`;
            
            targetRow.parentNode.insertBefore(formRow, targetRow.nextSibling);
            
            // Focus and setup textarea
            const textarea = formRow.querySelector('.comment-textarea');
            textarea.focus();
            
            // Auto-resize textarea
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(100, this.scrollHeight) + 'px';
                
                // Enable/disable submit button
                const submitBtn = formRow.querySelector('.comment-submit-btn');
                submitBtn.disabled = !this.value.trim();
            });
            
            // Add event listeners for form buttons
            formRow.querySelector('[data-cancel-comment]').addEventListener('click', hideCommentForm);
            formRow.querySelector('[data-submit-comment]').addEventListener('click', function() {
                const filePath = this.dataset.filePath;
                const lineNumber = parseInt(this.dataset.lineNumber);
                const lineType = this.dataset.lineType;
                submitComment(filePath, lineNumber, lineType);
            });
        }
        
        function hideCommentForm() {
            const existingForm = document.querySelector('.comment-form-row');
            if (existingForm) {
                existingForm.remove();
            }
            currentCommentThreadId = null;
        }
        
        function submitComment(filePath, lineNumber, lineType) {
            const textarea = document.querySelector('.comment-textarea');
            const content = textarea.value.trim();
            
            if (!content) return;
            
            // Disable form while submitting
            const submitBtn = document.querySelector('.comment-submit-btn');
            const cancelBtn = document.querySelector('.comment-cancel-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Commenting...';
            cancelBtn.disabled = true;
            
            vscode.postMessage({
                command: 'addComment',
                filePath: filePath,
                lineNumber: lineNumber,
                lineType: lineType,
                content: content
            });
        }
        
        function toggleCommentThread(threadId) {
            const container = document.querySelector(\`[data-thread-id="\${threadId}"]\`);
            if (container) {
                container.classList.toggle('comment-thread-collapsed');
            }
        }
        
        // Main event delegation for all clicks - this runs immediately
        (function() {
            document.addEventListener('click', function(event) {
                const target = event.target;
                
                // Handle add comment button clicks
                if (target.classList.contains('add-comment-button')) {
                    event.preventDefault();
                    const filePath = target.dataset.filePath;
                    const lineNumber = parseInt(target.dataset.lineNumber);
                    const lineType = target.dataset.lineType;
                    showCommentForm(filePath, lineNumber, lineType);
                }
                
                // Handle comment thread toggle
                if (target.hasAttribute('data-toggle-thread')) {
                    event.preventDefault();
                    const threadId = target.dataset.toggleThread;
                    toggleCommentThread(threadId);
                }
                
                // Handle comment edit
                if (target.hasAttribute('data-edit-comment')) {
                    event.preventDefault();
                    const commentId = target.dataset.editComment;
                    editComment(commentId);
                }
                
                // Handle comment copy
                if (target.hasAttribute('data-copy-comment')) {
                    event.preventDefault();
                    const commentData = JSON.parse(target.dataset.copyComment.replace(/&apos;/g, "'"));
                    copyComment(commentData);
                }
                
                // Handle comment delete
                if (target.hasAttribute('data-delete-comment')) {
                    event.preventDefault();
                    const commentId = target.dataset.deleteComment;
                    deleteComment(commentId);
                }
            });
        })();
        
        function editComment(commentId) {
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            if (!commentItem) return;
            
            const commentBody = commentItem.querySelector('.comment-body');
            const contentDiv = commentBody.querySelector('.comment-content');
            const actionsMenu = commentBody.querySelector('.comment-actions-menu');
            const currentContent = contentDiv.textContent;
            
            // Hide actions menu and replace content with edit form
            actionsMenu.style.display = 'none';
            contentDiv.innerHTML = \`
                <textarea class="comment-textarea" style="margin-bottom: 12px;">\${currentContent}</textarea>
                <div class="comment-form-actions">
                    <button class="comment-cancel-btn" data-cancel-edit="\${commentId}" data-original-content="\${currentContent.replace(/"/g, '&quot;')}">Cancel</button>
                    <button class="comment-submit-btn" data-save-edit="\${commentId}">Save</button>
                </div>
            \`;
            
            // Focus and auto-resize textarea
            const textarea = contentDiv.querySelector('.comment-textarea');
            textarea.focus();
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(100, this.scrollHeight) + 'px';
                
                const saveBtn = contentDiv.querySelector('.comment-submit-btn');
                saveBtn.disabled = !this.value.trim();
            });
            
            // Add event listeners for edit form buttons
            contentDiv.querySelector('[data-cancel-edit]').addEventListener('click', function() {
                const commentId = this.dataset.cancelEdit;
                const originalContent = this.dataset.originalContent;
                cancelEditComment(commentId, originalContent);
            });
            
            contentDiv.querySelector('[data-save-edit]').addEventListener('click', function() {
                const commentId = this.dataset.saveEdit;
                saveEditComment(commentId);
            });
        }
        
        function saveEditComment(commentId) {
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            const textarea = commentItem.querySelector('.comment-textarea');
            const newContent = textarea.value.trim();
            
            if (!newContent) return;
            
            // Disable form while saving
            const saveBtn = commentItem.querySelector('.comment-submit-btn');
            const cancelBtn = commentItem.querySelector('.comment-cancel-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            cancelBtn.disabled = true;
            
            vscode.postMessage({
                command: 'editComment',
                commentId: commentId,
                content: newContent
            });
        }
        
        function cancelEditComment(commentId, originalContent) {
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            const commentBody = commentItem.querySelector('.comment-body');
            const contentDiv = commentBody.querySelector('.comment-content');
            const actionsMenu = commentBody.querySelector('.comment-actions-menu');
            
            // Restore original content and show actions menu
            contentDiv.innerHTML = originalContent;
            actionsMenu.style.display = 'flex';
        }
        
        function deleteComment(commentId) {
            if (!commentId) {
                console.error('No comment ID provided to deleteComment');
                return;
            }
            
            // Skip confirmation dialog (not allowed in webview sandbox)
            // Add visual feedback immediately
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            if (commentItem) {
                commentItem.classList.add('deleting');
            }
            
            vscode.postMessage({
                command: 'deleteComment',
                commentId: commentId
            });
        }
        
        function copyComment(commentData) {
            vscode.postMessage({
                command: 'copySingleComment',
                comment: commentData
            });
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            // Handle reload completion message
            if (message.command === 'reloadComplete') {
                const reloadBtn = document.getElementById('reload-diff-btn');
                if (reloadBtn) {
                    reloadBtn.classList.remove('loading');
                    
                    if (message.success) {
                        // Successfully reloaded - reset button
                        reloadBtn.innerHTML = '<span>↻</span><span>Reload</span>';
                    } else {
                        // Error during reload - show error state
                        reloadBtn.innerHTML = '<span>↻</span><span>Reload Failed</span>';
                        
                        // Reset to normal state after 3 seconds
                        setTimeout(() => {
                            reloadBtn.innerHTML = '<span>↻</span><span>Reload</span>';
                        }, 3000);
                    }
                }
            }
            
            // Handle comment deletion confirmation
            if (message.command === 'commentDeleted') {
                const commentItem = document.querySelector(\`[data-comment-id="\${message.commentId}"]\`);
                if (commentItem) {
                    commentItem.classList.add('deleted');
                    // Check if this was the last comment in the thread
                    const threadContainer = commentItem.closest('.comment-thread-container');
                    if (threadContainer) {
                        const remainingComments = threadContainer.querySelectorAll('.comment-item:not(.deleted)');
                        if (remainingComments.length === 0) {
                            // Hide the entire thread row
                            const threadRow = threadContainer.closest('.comment-thread-row');
                            if (threadRow) {
                                threadRow.style.display = 'none';
                            }
                        } else {
                            // Update comment count in thread header
                            const threadHeader = threadContainer.querySelector('.comment-thread-header');
                            if (threadHeader) {
                                const count = remainingComments.length;
                                threadHeader.innerHTML = \`<span class="comment-thread-toggle">▼</span>\${count} comment\${count > 1 ? 's' : ''}\`;
                            }
                        }
                    }
                }
            }
        });

        // Auto-reload when webview gains focus
        let lastFocusTime = Date.now();
        let reloadDebounceTimer = null;
        
        function handleAutoReload() {
            const now = Date.now();
            // Only auto-reload if it's been more than 5 seconds since last focus
            if (now - lastFocusTime > 5000) {
                const reloadBtn = document.getElementById('reload-diff-btn');
                if (reloadBtn && !reloadBtn.classList.contains('loading')) {
                    // Debounce rapid focus events
                    if (reloadDebounceTimer) {
                        clearTimeout(reloadDebounceTimer);
                    }
                    
                    reloadDebounceTimer = setTimeout(() => {
                        reloadBtn.classList.add('loading');
                        reloadBtn.innerHTML = '<span>↻</span><span>Auto-reloading...</span>';
                        vscode.postMessage({ command: 'reload' });
                        lastFocusTime = now;
                    }, 500); // 500ms debounce
                }
            }
        }
        
        // Listen for window focus events
        window.addEventListener('focus', handleAutoReload);
        
        // Also listen for visibility change (when tab becomes active)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                handleAutoReload();
            }
        });
    </script>
</body>
</html>`;
  }

  getWorkingDirectoryContent(
    fileDiffs: FileDiff[],
    comments: Map<string, DiffComment[]> = new Map(),
    currentUser?: string,
  ): string {
    return this.generateDiffHTML(
      fileDiffs,
      "HEAD → Working Directory",
      "HEAD",
      "working",
      comments,
      currentUser,
    );
  }

  private generateDiffHTML(
    fileDiffs: FileDiff[],
    title: string,
    baseRef?: string,
    compareRef?: string,
    comments: Map<string, DiffComment[]> = new Map(),
    currentUser?: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diff View: ${title}</title>
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
            align-items: center;
        }
        
        .reload-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.2s;
        }
        
        .reload-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .reload-button:active {
            background: var(--vscode-button-background);
            transform: translateY(1px);
        }
        
        .reload-button.loading {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .copy-comments-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.2s;
        }
        
        .copy-comments-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .copy-comments-button:active {
            background: var(--vscode-button-background);
            transform: translateY(1px);
        }
        
        .copy-comments-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
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

        .file-header-title {
            cursor: pointer;
            transition: color 0.2s;
        }

        .file-header-title:hover {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
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

        /* GitHub-style Comment System */
        .diff-line-wrapper {
            position: relative;
        }

        /* Expand the clickable area for line numbers */
        .diff-line-wrapper {
            position: relative;
            min-height: 22px;
        }

        .add-comment-button {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s, background-color 0.2s;
            display: flex;
            align-items: center;
            padding-left: 4px;
            z-index: 10;
        }
        
        /* Show a visual indicator on hover */
        .add-comment-button::before {
            content: '+';
            background: var(--vscode-button-background);
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .diff-line:hover .add-comment-button {
            opacity: 1;
        }

        .add-comment-button:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .add-comment-button:hover::before {
            background: var(--vscode-button-hoverBackground);
            transform: scale(1.1);
        }

        .comment-thread-container {
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 8px;
            margin: 16px 32px;
            background: var(--vscode-editor-background);
            position: relative;
        }

        .comment-thread-container::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 8px;
            width: 0;
            height: 0;
            border-right: 8px solid var(--vscode-editorWidget-border);
            border-top: 8px solid transparent;
            border-bottom: 8px solid transparent;
        }

        .comment-thread-container::after {
            content: '';
            position: absolute;
            left: -7px;
            top: 8px;
            width: 0;
            height: 0;
            border-right: 8px solid var(--vscode-editor-background);
            border-top: 8px solid transparent;
            border-bottom: 8px solid transparent;
        }

        .comment-thread-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            background: var(--vscode-editorWidget-background);
            border-radius: 8px 8px 0 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            user-select: none;
        }

        .comment-thread-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .comment-thread-toggle {
            display: inline-block;
            margin-right: 8px;
            transition: transform 0.2s;
        }

        .comment-thread-collapsed .comment-thread-toggle {
            transform: rotate(-90deg);
        }

        .comment-thread-body {
            display: block;
        }

        .comment-thread-collapsed .comment-thread-body {
            display: none;
        }

        .comment-item {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            display: flex;
            gap: 12px;
        }

        .comment-item:last-child {
            border-bottom: none;
            border-radius: 0 0 8px 8px;
        }

        .comment-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--vscode-button-background);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-button-foreground);
            flex-shrink: 0;
        }

        .comment-body {
            flex: 1;
            min-width: 0;
        }

        .comment-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 12px;
        }

        .comment-author {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }

        .comment-timestamp {
            color: var(--vscode-descriptionForeground);
        }

        .comment-content {
            font-size: 13px;
            line-height: 1.5;
            color: var(--vscode-editor-foreground);
            word-wrap: break-word;
            white-space: pre-wrap;
        }

        .comment-actions-menu {
            display: flex;
            gap: 12px;
            margin-top: 8px;
        }

        .comment-action-btn {
            background: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s;
            min-width: 50px;
        }

        .comment-action-btn:hover {
            background: var(--vscode-button-hoverBackground);
            color: var(--vscode-button-foreground);
            transform: translateY(-1px);
        }

        .comment-action-btn:active {
            transform: translateY(0);
        }

        .comment-form-container {
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 8px;
            margin: 16px 32px;
            background: var(--vscode-editor-background);
            position: relative;
        }

        .comment-form-container::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 16px;
            width: 0;
            height: 0;
            border-right: 8px solid var(--vscode-editorWidget-border);
            border-top: 8px solid transparent;
            border-bottom: 8px solid transparent;
        }

        .comment-form-container::after {
            content: '';
            position: absolute;
            left: -7px;
            top: 16px;
            width: 0;
            height: 0;
            border-right: 8px solid var(--vscode-editor-background);
            border-top: 8px solid transparent;
            border-bottom: 8px solid transparent;
        }

        .comment-form {
            padding: 16px;
            display: flex;
            gap: 12px;
        }

        .comment-form-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--vscode-button-background);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-button-foreground);
            flex-shrink: 0;
        }

        .comment-form-body {
            flex: 1;
        }

        .comment-textarea {
            width: 100%;
            min-height: 100px;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 13px;
            line-height: 1.4;
            resize: vertical;
            box-sizing: border-box;
        }

        .comment-textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .comment-form-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            justify-content: flex-end;
        }

        .comment-submit-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
        }

        .comment-submit-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .comment-submit-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .comment-cancel-btn {
            background: none;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-input-border);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
        }

        .comment-cancel-btn:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
        }

        /* Deletion animation */
        .comment-item.deleting {
            opacity: 0.5;
            transform: scale(0.95);
            transition: opacity 0.3s, transform 0.3s;
            pointer-events: none;
        }

        .comment-item.deleted {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.escapeHtml(title)}</h1>
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
            <button class="reload-button" id="reload-diff-btn">
                <span>↻</span>
                <span>Reload</span>
            </button>
            <button class="copy-comments-button" id="copy-comments-btn">
                <span>📋</span>
                <span>Copy Comments</span>
            </button>
        </div>
    </div>
    
    ${
      fileDiffs.length > 3
        ? `
    <div class="file-nav">
        <div class="file-nav-title">Files Changed</div>
        ${fileDiffs
          .map(
            (file) => `
            <a href="#file-${this.escapeHtml(file.path.replace(/[^a-zA-Z0-9]/g, "-"))}"
               class="file-link"
               data-file-path="${this.escapeHtml(file.path)}"
               title="Click to open in editor">
                ${this.escapeHtml(file.path)}
                <span class="file-stats">
                    <span class="additions">+${file.additions}</span>
                    <span class="deletions">-${file.deletions}</span>
                </span>
            </a>
        `,
          )
          .join("")}
    </div>
    `
        : ""
    }
    
    <div class="content">
        ${
          fileDiffs.length === 0
            ? '<div class="empty-diff">No changes found between these branches</div>'
            : fileDiffs
                .map((file) =>
                  this.renderFileDiff(
                    file,
                    comments.get(file.path) || [],
                    baseRef,
                    compareRef,
                  ),
                )
                .join("")
        }
    </div>
    
    <script>
        // VS Code API
        const vscode = acquireVsCodeApi();
        
        // Initialize all event listeners - called immediately and after reloads
        function initializeEventListeners() {
            // Smooth scroll for navigation links
            document.querySelectorAll('.file-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(link.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    // Also open the file in editor
                    const filePath = link.dataset.filePath;
                    if (filePath) {
                        vscode.postMessage({ command: 'openFile', filePath: filePath });
                    }
                });
            });

            // Add event listener for file headers
            document.querySelectorAll('.file-header-title').forEach(header => {
                header.addEventListener('click', (e) => {
                    const filePath = header.dataset.filePath;
                    if (filePath) {
                        vscode.postMessage({ command: 'openFile', filePath: filePath });
                    }
                });
            });
            
            // Reload button functionality
            const reloadBtn = document.getElementById('reload-diff-btn');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', function() {
                    this.classList.add('loading');
                    this.innerHTML = '<span>↻</span><span>Loading...</span>';
                    vscode.postMessage({ command: 'reload' });
                });
            }
            
            // Copy comments button functionality
            const copyCommentsBtn = document.getElementById('copy-comments-btn');
            if (copyCommentsBtn) {
                copyCommentsBtn.addEventListener('click', function() {
                    this.disabled = true;
                    this.innerHTML = '<span>📋</span><span>Copying...</span>';
                    vscode.postMessage({ command: 'copyComments' });
                    
                    // Reset button state after a delay
                    setTimeout(() => {
                        this.disabled = false;
                        this.innerHTML = '<span>📋</span><span>Copy Comments</span>';
                    }, 1000);
                });
            }
        }
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeEventListeners);
        } else {
            initializeEventListeners();
        }
        
        // Set current user info from extension
        const currentUserName = ${JSON.stringify(currentUser || "User")};
        let currentCommentThreadId = null;
        
        function getCurrentUserInitials() {
            return currentUserName
                .split(' ')
                .map(name => name.charAt(0).toUpperCase())
                .join('')
                .substring(0, 2);
        }
        
        function showCommentForm(filePath, lineNumber, lineType) {
            // Remove any existing form
            hideCommentForm();
            
            const targetRow = document.querySelector(\`tr[data-line-num="\${lineNumber}"][data-line-type="\${lineType}"]\`);
            if (!targetRow) {
                return;
            }
            
            const threadId = \`\${filePath}-\${lineNumber}-\${lineType}\`;
            currentCommentThreadId = threadId;
            
            const formRow = document.createElement('tr');
            formRow.classList.add('comment-form-row');
            formRow.innerHTML = \`
                <td colspan="3">
                    <div class="comment-form-container">
                        <div class="comment-form">
                            <div class="comment-form-avatar">\${getCurrentUserInitials()}</div>
                            <div class="comment-form-body">
                                <textarea class="comment-textarea" placeholder="Leave a comment" data-thread-id="\${threadId}"></textarea>
                                <div class="comment-form-actions">
                                    <button class="comment-cancel-btn" data-cancel-comment>Cancel</button>
                                    <button class="comment-submit-btn" data-submit-comment data-file-path="\${filePath}" data-line-number="\${lineNumber}" data-line-type="\${lineType}">Comment</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            \`;
            
            targetRow.parentNode.insertBefore(formRow, targetRow.nextSibling);
            
            // Focus and setup textarea
            const textarea = formRow.querySelector('.comment-textarea');
            textarea.focus();
            
            // Auto-resize textarea
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(100, this.scrollHeight) + 'px';
                
                // Enable/disable submit button
                const submitBtn = formRow.querySelector('.comment-submit-btn');
                submitBtn.disabled = !this.value.trim();
            });
            
            // Add event listeners for form buttons
            formRow.querySelector('[data-cancel-comment]').addEventListener('click', hideCommentForm);
            formRow.querySelector('[data-submit-comment]').addEventListener('click', function() {
                const filePath = this.dataset.filePath;
                const lineNumber = parseInt(this.dataset.lineNumber);
                const lineType = this.dataset.lineType;
                submitComment(filePath, lineNumber, lineType);
            });
        }
        
        function hideCommentForm() {
            const existingForm = document.querySelector('.comment-form-row');
            if (existingForm) {
                existingForm.remove();
            }
            currentCommentThreadId = null;
        }
        
        function submitComment(filePath, lineNumber, lineType) {
            const textarea = document.querySelector('.comment-textarea');
            const content = textarea.value.trim();
            
            if (!content) return;
            
            // Disable form while submitting
            const submitBtn = document.querySelector('.comment-submit-btn');
            const cancelBtn = document.querySelector('.comment-cancel-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Commenting...';
            cancelBtn.disabled = true;
            
            vscode.postMessage({
                command: 'addComment',
                filePath: filePath,
                lineNumber: lineNumber,
                lineType: lineType,
                content: content
            });
        }
        
        function toggleCommentThread(threadId) {
            const container = document.querySelector(\`[data-thread-id="\${threadId}"]\`);
            if (container) {
                container.classList.toggle('comment-thread-collapsed');
            }
        }
        
        // Main event delegation for all clicks - this runs immediately
        (function() {
            document.addEventListener('click', function(event) {
                const target = event.target;
                
                // Handle add comment button clicks
                if (target.classList.contains('add-comment-button')) {
                    event.preventDefault();
                    const filePath = target.dataset.filePath;
                    const lineNumber = parseInt(target.dataset.lineNumber);
                    const lineType = target.dataset.lineType;
                    showCommentForm(filePath, lineNumber, lineType);
                }
                
                // Handle comment thread toggle
                if (target.hasAttribute('data-toggle-thread')) {
                    event.preventDefault();
                    const threadId = target.dataset.toggleThread;
                    toggleCommentThread(threadId);
                }
                
                // Handle comment edit
                if (target.hasAttribute('data-edit-comment')) {
                    event.preventDefault();
                    const commentId = target.dataset.editComment;
                    editComment(commentId);
                }
                
                // Handle comment copy
                if (target.hasAttribute('data-copy-comment')) {
                    event.preventDefault();
                    const commentData = JSON.parse(target.dataset.copyComment.replace(/&apos;/g, "'"));
                    copyComment(commentData);
                }
                
                // Handle comment delete
                if (target.hasAttribute('data-delete-comment')) {
                    event.preventDefault();
                    const commentId = target.dataset.deleteComment;
                    deleteComment(commentId);
                }
            });
        })();
        
        function editComment(commentId) {
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            if (!commentItem) return;
            
            const commentBody = commentItem.querySelector('.comment-body');
            const contentDiv = commentBody.querySelector('.comment-content');
            const actionsMenu = commentBody.querySelector('.comment-actions-menu');
            const currentContent = contentDiv.textContent;
            
            // Hide actions menu and replace content with edit form
            actionsMenu.style.display = 'none';
            contentDiv.innerHTML = \`
                <textarea class="comment-textarea" style="margin-bottom: 12px;">\${currentContent}</textarea>
                <div class="comment-form-actions">
                    <button class="comment-cancel-btn" data-cancel-edit="\${commentId}" data-original-content="\${currentContent.replace(/"/g, '&quot;')}">Cancel</button>
                    <button class="comment-submit-btn" data-save-edit="\${commentId}">Save</button>
                </div>
            \`;
            
            // Focus and auto-resize textarea
            const textarea = contentDiv.querySelector('.comment-textarea');
            textarea.focus();
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.max(100, this.scrollHeight) + 'px';
                
                const saveBtn = contentDiv.querySelector('.comment-submit-btn');
                saveBtn.disabled = !this.value.trim();
            });
            
            // Add event listeners for edit form buttons
            contentDiv.querySelector('[data-cancel-edit]').addEventListener('click', function() {
                const commentId = this.dataset.cancelEdit;
                const originalContent = this.dataset.originalContent;
                cancelEditComment(commentId, originalContent);
            });
            
            contentDiv.querySelector('[data-save-edit]').addEventListener('click', function() {
                const commentId = this.dataset.saveEdit;
                saveEditComment(commentId);
            });
        }
        
        function saveEditComment(commentId) {
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            const textarea = commentItem.querySelector('.comment-textarea');
            const newContent = textarea.value.trim();
            
            if (!newContent) return;
            
            // Disable form while saving
            const saveBtn = commentItem.querySelector('.comment-submit-btn');
            const cancelBtn = commentItem.querySelector('.comment-cancel-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            cancelBtn.disabled = true;
            
            vscode.postMessage({
                command: 'editComment',
                commentId: commentId,
                content: newContent
            });
        }
        
        function cancelEditComment(commentId, originalContent) {
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            const commentBody = commentItem.querySelector('.comment-body');
            const contentDiv = commentBody.querySelector('.comment-content');
            const actionsMenu = commentBody.querySelector('.comment-actions-menu');
            
            // Restore original content and show actions menu
            contentDiv.innerHTML = originalContent;
            actionsMenu.style.display = 'flex';
        }
        
        function deleteComment(commentId) {
            // Skip confirmation dialog (not allowed in webview sandbox)
            // Add visual feedback immediately
            const commentItem = document.querySelector(\`[data-comment-id="\${commentId}"]\`);
            if (commentItem) {
                commentItem.classList.add('deleting');
            }
            
            vscode.postMessage({
                command: 'deleteComment',
                commentId: commentId
            });
        }
        
        function copyComment(commentData) {
            vscode.postMessage({
                command: 'copySingleComment',
                comment: commentData
            });
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            // Handle reload completion message
            if (message.command === 'reloadComplete') {
                const reloadBtn = document.getElementById('reload-diff-btn');
                if (reloadBtn) {
                    reloadBtn.classList.remove('loading');
                    
                    if (message.success) {
                        // Successfully reloaded - reset button
                        reloadBtn.innerHTML = '<span>↻</span><span>Reload</span>';
                    } else {
                        // Error during reload - show error state
                        reloadBtn.innerHTML = '<span>↻</span><span>Reload Failed</span>';
                        
                        // Reset to normal state after 3 seconds
                        setTimeout(() => {
                            reloadBtn.innerHTML = '<span>↻</span><span>Reload</span>';
                        }, 3000);
                    }
                }
            }
            
            // Handle comment deletion confirmation
            if (message.command === 'commentDeleted') {
                const commentItem = document.querySelector(\`[data-comment-id="\${message.commentId}"]\`);
                if (commentItem) {
                    commentItem.classList.add('deleted');
                    // Check if this was the last comment in the thread
                    const threadContainer = commentItem.closest('.comment-thread-container');
                    if (threadContainer) {
                        const remainingComments = threadContainer.querySelectorAll('.comment-item:not(.deleted)');
                        if (remainingComments.length === 0) {
                            // Hide the entire thread row
                            const threadRow = threadContainer.closest('.comment-thread-row');
                            if (threadRow) {
                                threadRow.style.display = 'none';
                            }
                        } else {
                            // Update comment count in thread header
                            const threadHeader = threadContainer.querySelector('.comment-thread-header');
                            if (threadHeader) {
                                const count = remainingComments.length;
                                threadHeader.innerHTML = \`<span class="comment-thread-toggle">▼</span>\${count} comment\${count > 1 ? 's' : ''}\`;
                            }
                        }
                    }
                }
            }
        });

        // Auto-reload when webview gains focus
        let lastFocusTime = Date.now();
        let reloadDebounceTimer = null;
        
        function handleAutoReload() {
            const now = Date.now();
            // Only auto-reload if it's been more than 5 seconds since last focus
            if (now - lastFocusTime > 5000) {
                const reloadBtn = document.getElementById('reload-diff-btn');
                if (reloadBtn && !reloadBtn.classList.contains('loading')) {
                    // Debounce rapid focus events
                    if (reloadDebounceTimer) {
                        clearTimeout(reloadDebounceTimer);
                    }
                    
                    reloadDebounceTimer = setTimeout(() => {
                        reloadBtn.classList.add('loading');
                        reloadBtn.innerHTML = '<span>↻</span><span>Auto-reloading...</span>';
                        vscode.postMessage({ command: 'reload' });
                        lastFocusTime = now;
                    }, 500); // 500ms debounce
                }
            }
        }
        
        // Listen for window focus events
        window.addEventListener('focus', handleAutoReload);
        
        // Also listen for visibility change (when tab becomes active)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                handleAutoReload();
            }
        });
    </script>
</body>
</html>`;
  }

  private renderFileDiff(
    file: FileDiff,
    comments: DiffComment[] = [],
    baseRef?: string,
    compareRef?: string,
  ): string {
    const lines = file.content.split("\n");
    const hunks = this.parseDiff(lines);
    const fileId = file.path.replace(/[^a-zA-Z0-9]/g, "-");

    return `
        <div class="file-diff" id="file-${this.escapeHtml(fileId)}">
            <div class="file-header">
                <h2 class="file-header-title" data-file-path="${this.escapeHtml(file.path)}" title="Click to open in editor">${this.escapeHtml(file.path)}</h2>
                <div class="file-stats">
                    <span class="additions">+${file.additions}</span>
                    <span class="deletions">-${file.deletions}</span>
                </div>
            </div>
            ${
              hunks.length > 0
                ? `<table class="diff-table"><tbody>${this.renderHunks(hunks, file.path, comments, baseRef, compareRef)}</tbody></table>`
                : '<div class="no-changes">No changes in this file</div>'
            }
        </div>`;
  }

  private renderHunks(
    hunks: any[],
    filePath: string,
    comments: DiffComment[] = [],
    baseRef?: string,
    compareRef?: string,
  ): string {
    let html = "";

    for (const hunk of hunks) {
      html += `<tr><td colspan="3" class="diff-hunk-header">${this.escapeHtml(hunk.header)}</td></tr>`;

      for (const line of hunk.lines) {
        const lineClass = `diff-line-${line.type}`;
        const lineNumber = line.newLineNum || line.oldLineNum;

        // GitHub-style + button positioning
        const addCommentButton = lineNumber
          ? `<button class="add-comment-button" data-file-path="${this.escapeHtml(filePath)}" data-line-number="${lineNumber}" data-line-type="${line.type}" title="Add a comment to this line">+</button>`
          : "";

        html += `
                    <tr class="diff-line ${lineClass}" data-line-num="${lineNumber}" data-line-type="${line.type}">
                        <td class="diff-line-num">
                            <div class="diff-line-wrapper">
                                ${addCommentButton}
                                ${line.oldLineNum}
                            </div>
                        </td>
                        <td class="diff-line-num">${line.newLineNum}</td>
                        <td class="diff-line-content">${this.escapeHtml(line.content)}</td>
                    </tr>
                `;

        // Add existing comment thread for this line
        const lineComments = comments.filter(
          (comment) =>
            comment.lineNumber === lineNumber && comment.lineType === line.type,
        );

        if (lineComments.length > 0) {
          const threadId = `${filePath}-${lineNumber}-${line.type}`;
          const commentCount = lineComments.length;
          const isCollapsed = false; // Always expanded by default

          html += `
                        <tr class="comment-thread-row">
                            <td colspan="3">
                                <div class="comment-thread-container ${isCollapsed ? "comment-thread-collapsed" : ""}" data-thread-id="${threadId}">
                                    <div class="comment-thread-header" data-toggle-thread="${threadId}">
                                        <span class="comment-thread-toggle">▼</span>
                                        ${commentCount} comment${commentCount > 1 ? "s" : ""}
                                    </div>
                                    <div class="comment-thread-body">
                                        ${lineComments.map((comment) => this.renderComment(comment)).join("")}
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
        }
      }
    }

    return html;
  }

  private renderComment(comment: DiffComment): string {
    const timestamp = new Date(comment.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const authorInitials = this.getAuthorInitials(comment.author);

    return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-avatar">${authorInitials}</div>
                <div class="comment-body">
                    <div class="comment-header">
                        <span class="comment-author">${this.escapeHtml(comment.author)}</span>
                        <span class="comment-timestamp">${timestamp}</span>
                    </div>
                    <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                    <div class="comment-actions-menu">
                        <button class="comment-action-btn" data-copy-comment='${JSON.stringify(
                          {
                            id: comment.id,
                            filePath: comment.filePath,
                            lineNumber: comment.lineNumber,
                            lineType: comment.lineType,
                            content: comment.content,
                            author: comment.author,
                            timestamp: comment.timestamp,
                            baseRef: comment.baseRef,
                            compareRef: comment.compareRef,
                          },
                        ).replace(/'/g, "&apos;")}'>📋 Copy</button>
                        <button class="comment-action-btn" data-edit-comment="${comment.id}">✏️ Edit</button>
                        <button class="comment-action-btn" data-delete-comment="${comment.id}">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
  }

  private getAuthorInitials(author: string): string {
    return author
      .split(" ")
      .map((name) => name.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
  }
}
