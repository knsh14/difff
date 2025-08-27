import * as vscode from "vscode";
import { CommentService, DiffComment } from "./commentService";
import { GitService } from "./gitService";

export class CommentKey extends vscode.TreeItem {
  constructor(
    public readonly key: string,
    public readonly commentCount: number,
    public readonly baseRef?: string,
    public readonly compareRef?: string,
  ) {
    super(key, vscode.TreeItemCollapsibleState.Collapsed);

    this.description = `${commentCount} comment${commentCount === 1 ? "" : "s"}`;
    this.contextValue = "commentKey";
    this.iconPath = new vscode.ThemeIcon("git-commit");
    this.tooltip = `${key}\n${commentCount} comment${commentCount === 1 ? "" : "s"}`;
  }
}

export class CommentItem extends vscode.TreeItem {
  constructor(public readonly comment: DiffComment) {
    const label = `${comment.filePath}:${comment.lineNumber}`;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description =
      comment.content.length > 50
        ? comment.content.substring(0, 50) + "..."
        : comment.content;
    this.contextValue = "commentItem";
    this.iconPath = new vscode.ThemeIcon("comment");
    this.tooltip = `${comment.filePath} line ${comment.lineNumber}\n${comment.content}\n\nAuthor: ${comment.author}\nDate: ${new Date(comment.timestamp).toLocaleString()}`;

    this.command = {
      command: "difff.jumpToComment",
      title: "Jump to Comment",
      arguments: [this.comment],
    };
  }
}

export type CommentTreeNode = CommentKey | CommentItem;

export class CommentExplorerProvider
  implements vscode.TreeDataProvider<CommentTreeNode>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    CommentTreeNode | undefined | null | void
  > = new vscode.EventEmitter<CommentTreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CommentTreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private commentService: CommentService,
    private gitService: GitService,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommentTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CommentTreeNode): Promise<CommentTreeNode[]> {
    if (!element) {
      // Root level - show comment keys (commit hashes/branch names)
      return this.getCommentKeys();
    }

    if (element instanceof CommentKey) {
      // Show comments for this key
      return this.getCommentsForKey(element);
    }

    return [];
  }

  private async getCommentKeys(): Promise<CommentKey[]> {
    const allComments = this.getAllComments();
    const keyMap = new Map<
      string,
      { count: number; baseRef?: string; compareRef?: string }
    >();

    // Group comments by their diff context (baseRef + compareRef combination)
    for (const comment of allComments) {
      const key = this.generateKeyFromComment(comment);
      const existing = keyMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        keyMap.set(key, {
          count: 1,
          baseRef: comment.baseRef,
          compareRef: comment.compareRef,
        });
      }
    }

    // Convert to CommentKey items
    const keys: CommentKey[] = [];
    for (const [keyStr, data] of keyMap.entries()) {
      keys.push(
        new CommentKey(keyStr, data.count, data.baseRef, data.compareRef),
      );
    }

    // Sort by key name
    keys.sort((a, b) => a.key.localeCompare(b.key));
    return keys;
  }

  private getCommentsForKey(key: CommentKey): CommentItem[] {
    const allComments = this.getAllComments();
    const keyComments = allComments.filter((comment) => {
      return (
        comment.baseRef === key.baseRef && comment.compareRef === key.compareRef
      );
    });

    // Sort comments by file path, then by line number
    keyComments.sort((a, b) => {
      if (a.filePath !== b.filePath) {
        return a.filePath.localeCompare(b.filePath);
      }
      return a.lineNumber - b.lineNumber;
    });

    return keyComments.map((comment) => new CommentItem(comment));
  }

  private generateKeyFromComment(comment: DiffComment): string {
    if (comment.compareRef === "working") {
      return `${comment.baseRef} → Working Directory`;
    } else if (comment.baseRef && comment.compareRef) {
      return `${comment.baseRef} → ${comment.compareRef}`;
    } else {
      // Fallback for legacy comments
      return comment.baseRef || comment.compareRef || "Unknown";
    }
  }

  private getAllComments(): DiffComment[] {
    // Access private method through type assertion
    return (this.commentService as any).getAllComments();
  }

  /**
   * Remove all comments for a specific key
   */
  async removeAllCommentsForKey(key: CommentKey): Promise<void> {
    const allComments = this.getAllComments();
    const filteredComments = allComments.filter((comment) => {
      return !(
        comment.baseRef === key.baseRef && comment.compareRef === key.compareRef
      );
    });

    // Save the filtered comments
    (this.commentService as any).saveComments(filteredComments);
    this.refresh();
  }

  /**
   * Get the comment key that a comment belongs to
   */
  getKeyForComment(comment: DiffComment): string {
    return this.generateKeyFromComment(comment);
  }
}
