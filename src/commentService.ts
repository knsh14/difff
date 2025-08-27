import * as vscode from "vscode";

export interface DiffComment {
  id: string;
  filePath: string;
  lineNumber: number;
  lineType: "addition" | "deletion" | "context";
  content: string;
  author: string;
  timestamp: number;
  baseRef?: string;
  compareRef?: string;
}

export class CommentService {
  private context: vscode.ExtensionContext;
  private readonly storageKey = "difff.comments";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get all comments for a specific file and diff context
   */
  getComments(
    filePath: string,
    baseRef?: string,
    compareRef?: string,
  ): DiffComment[] {
    const allComments = this.getAllComments();
    return allComments.filter(
      (comment) =>
        comment.filePath === filePath &&
        comment.baseRef === baseRef &&
        comment.compareRef === compareRef,
    );
  }

  /**
   * Add a new comment
   */
  addComment(
    filePath: string,
    lineNumber: number,
    lineType: "addition" | "deletion" | "context",
    content: string,
    baseRef?: string,
    compareRef?: string,
  ): DiffComment {
    const comment: DiffComment = {
      id: this.generateId(),
      filePath,
      lineNumber,
      lineType,
      content,
      author: this.getCurrentUser(),
      timestamp: Date.now(),
      baseRef,
      compareRef,
    };

    const allComments = this.getAllComments();
    allComments.push(comment);
    this.saveComments(allComments);

    return comment;
  }

  /**
   * Update an existing comment
   */
  updateComment(id: string, content: string): DiffComment | null {
    const allComments = this.getAllComments();
    const commentIndex = allComments.findIndex((c) => c.id === id);

    if (commentIndex === -1) {
      return null;
    }

    allComments[commentIndex].content = content;
    allComments[commentIndex].timestamp = Date.now();
    this.saveComments(allComments);

    return allComments[commentIndex];
  }

  /**
   * Delete a comment
   */
  deleteComment(id: string): boolean {
    const allComments = this.getAllComments();
    const filteredComments = allComments.filter((c) => c.id !== id);

    if (filteredComments.length === allComments.length) {
      return false; // Comment not found
    }

    this.saveComments(filteredComments);
    return true;
  }

  /**
   * Get all comments from storage
   */
  private getAllComments(): DiffComment[] {
    const stored = this.context.globalState.get<DiffComment[]>(this.storageKey);
    return stored || [];
  }

  /**
   * Save comments to storage
   */
  private saveComments(comments: DiffComment[]): void {
    this.context.globalState.update(this.storageKey, comments);
  }

  /**
   * Generate a unique ID for comments
   */
  private generateId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current user name (fallback to system user)
   */
  private getCurrentUser(): string {
    const gitConfig = vscode.workspace.getConfiguration("git");
    const userName = gitConfig.get<string>("user.name");
    return userName || require("os").userInfo().username || "Anonymous";
  }

  /**
   * Clear all comments (for testing/debugging)
   */
  clearAllComments(): void {
    this.context.globalState.update(this.storageKey, []);
  }

  /**
   * Copy all comments for a diff context in @file name line number comment format
   */
  copyCommentsToClipboard(baseRef?: string, compareRef?: string): string {
    const allComments = this.getAllComments();
    const filteredComments = allComments.filter(
      (comment) =>
        comment.baseRef === baseRef && comment.compareRef === compareRef,
    );

    if (filteredComments.length === 0) {
      return "";
    }

    // Sort comments by file path, then by line number
    filteredComments.sort((a, b) => {
      if (a.filePath !== b.filePath) {
        return a.filePath.localeCompare(b.filePath);
      }
      return a.lineNumber - b.lineNumber;
    });

    // Format comments as "@file name line number comment"
    const formattedComments = filteredComments.map(
      (comment) =>
        `@${comment.filePath} ${comment.lineNumber} ${comment.content}`,
    );

    return formattedComments.join("\n");
  }
}
