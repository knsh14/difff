import * as vscode from "vscode";
import {
  DiffExplorerProvider,
  DiffFile,
  BranchSelector,
  ModeSelector,
} from "./diffExplorer";
import { GitService } from "./gitService";
import { DiffWebviewProvider, FileDiff } from "./webviewProvider";
import { CommentService } from "./commentService";
import { CommentExplorerProvider, CommentKey } from "./commentExplorer";
import {
  CommentTemplateProvider,
  CommentTemplateItem,
} from "./commentTemplateProvider";

export function activate(context: vscode.ExtensionContext) {
  // Check if we're in a git repository
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage(
      "No workspace folder found. Please open a folder first.",
    );
    return;
  }

  let gitService: GitService;
  try {
    gitService = new GitService();
  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to initialize Git service. Make sure you have a git repository.",
    );
    return;
  }

  const diffExplorerProvider = new DiffExplorerProvider(gitService);
  const diffWebviewProvider = new DiffWebviewProvider(context.extensionUri);
  const commentService = new CommentService(context);
  const commentExplorerProvider = new CommentExplorerProvider(
    commentService,
    gitService,
  );
  const commentTemplateProvider = new CommentTemplateProvider(
    context,
    commentService,
  );

  vscode.window.registerTreeDataProvider(
    "difff.explorer",
    diffExplorerProvider,
  );
  vscode.window.registerTreeDataProvider(
    "difff.comments",
    commentExplorerProvider,
  );
  vscode.window.registerTreeDataProvider(
    "difff.templates",
    commentTemplateProvider,
  );

  const selectModeCommand = vscode.commands.registerCommand(
    "difff.selectMode",
    async (mode: "branch" | "working") => {
      diffExplorerProvider.setMode(mode);

      // If switching to working mode, auto-open diff view
      if (mode === "working") {
        vscode.commands.executeCommand("difff.viewDiff");
      }
    },
  );

  const selectBranchesCommand = vscode.commands.registerCommand(
    "difff.selectBranches",
    async (type?: "base" | "compare") => {
      try {
        const refs = await gitService.getAllRefs();

        if (!refs || refs.length === 0) {
          vscode.window.showErrorMessage(
            "No git references found. Make sure you have a git repository with commits.",
          );
          return;
        }

        if (type === "base" || !type) {
          const baseRef = await vscode.window.showQuickPick(refs, {
            placeHolder: "Select base branch/tag/commit (compare from)",
          });

          if (!baseRef) return;

          if (!type) {
            const compareRef = await vscode.window.showQuickPick(refs, {
              placeHolder: "Select compare branch/tag/commit (compare to)",
            });

            if (!compareRef) return;
            const bothSelected = await diffExplorerProvider.setRefs(
              baseRef,
              compareRef,
            );
            if (bothSelected) {
              // Auto-open diff view when both branches are selected
              vscode.commands.executeCommand("difff.viewDiff");
            }
          } else {
            const currentCompare = diffExplorerProvider.getCompareRef();
            if (currentCompare) {
              const bothSelected = await diffExplorerProvider.setRefs(
                baseRef,
                currentCompare,
              );
              if (bothSelected) {
                vscode.commands.executeCommand("difff.viewDiff");
              }
            } else {
              await diffExplorerProvider.setRefs(baseRef, "");
            }
          }
        } else if (type === "compare") {
          const currentBase = diffExplorerProvider.getBaseRef();
          if (!currentBase) {
            vscode.window.showInformationMessage(
              "Please select a base branch first",
            );
            return;
          }

          const compareRef = await vscode.window.showQuickPick(refs, {
            placeHolder: "Select compare branch/tag/commit (compare to)",
          });

          if (!compareRef) return;
          const bothSelected = await diffExplorerProvider.setRefs(
            currentBase,
            compareRef,
          );
          if (bothSelected) {
            vscode.commands.executeCommand("difff.viewDiff");
          }
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error selecting branches: ${error.message}`,
        );
      }
    },
  );

  const refreshCommand = vscode.commands.registerCommand(
    "difff.refresh",
    () => {
      // Refresh the tree view
      diffExplorerProvider.refresh();

      // If ready for diff, also refresh the diff view
      if (diffExplorerProvider.isReadyForDiff()) {
        vscode.commands.executeCommand("difff.viewDiff");
      }
    },
  );

  const openFileCommand = vscode.commands.registerCommand(
    "difff.openFile",
    async (file: DiffFile) => {
      if (!file) return;

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const baseRef = diffExplorerProvider.getBaseRef();
      const compareRef = diffExplorerProvider.getCompareRef();

      if (!baseRef || !compareRef) {
        vscode.window.showErrorMessage(
          "Please select branches to compare first",
        );
        return;
      }

      try {
        // Try to use webview first for GitHub-like display
        const panel = vscode.window.createWebviewPanel(
          "difff.diffView",
          `Diff: ${file.path}`,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          },
        );

        const diffContent = await gitService.getFileDiff(
          baseRef,
          compareRef,
          file.path,
        );
        panel.webview.html = diffWebviewProvider.getWebviewContent(
          diffContent,
          file.path,
        );
      } catch (error) {
        // Fallback to native VS Code diff
        try {
          const baseUri = vscode.Uri.parse(`git:${file.path}?${baseRef}`);
          const compareUri = vscode.Uri.parse(`git:${file.path}?${compareRef}`);
          const title = `${file.path}: ${baseRef} ↔ ${compareRef}`;
          await vscode.commands.executeCommand(
            "vscode.diff",
            baseUri,
            compareUri,
            title,
          );
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to open diff: ${err}`);
        }
      }
    },
  );

  const viewDiffCommand = vscode.commands.registerCommand(
    "difff.viewDiff",
    async () => {
      const mode = diffExplorerProvider.getMode();

      // Show loading message
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title:
            mode === "working"
              ? "Loading working directory changes..."
              : "Loading branch diffs...",
          cancellable: false,
        },
        async (progress) => {
          try {
            let diffFiles: any[] = [];
            let fileDiffs: FileDiff[] = [];
            let title = "";

            if (mode === "working") {
              // Working directory mode
              title = "Working Directory Changes";
              diffFiles = await gitService.getWorkingDirectoryFiles();

              for (let i = 0; i < diffFiles.length; i++) {
                const file = diffFiles[i];
                progress.report({
                  increment: 100 / diffFiles.length,
                  message: `Processing ${file.path}...`,
                });

                const content = await gitService.getWorkingDirectoryFileDiff(
                  file.path,
                );
                fileDiffs.push({
                  path: file.path,
                  content: content,
                  additions: file.additions,
                  deletions: file.deletions,
                });
              }
            } else {
              // Branch comparison mode
              const baseRef = diffExplorerProvider.getBaseRef();
              const compareRef = diffExplorerProvider.getCompareRef();

              if (!baseRef || !compareRef) {
                vscode.window.showErrorMessage(
                  "Please select branches to compare first",
                );
                return;
              }

              title = `${baseRef} → ${compareRef}`;
              diffFiles = await gitService.getDiffFiles(baseRef, compareRef);

              for (let i = 0; i < diffFiles.length; i++) {
                const file = diffFiles[i];
                progress.report({
                  increment: 100 / diffFiles.length,
                  message: `Processing ${file.path}...`,
                });

                const content = await gitService.getFileDiff(
                  baseRef,
                  compareRef,
                  file.path,
                );
                fileDiffs.push({
                  path: file.path,
                  content: content,
                  additions: file.additions,
                  deletions: file.deletions,
                });
              }
            }

            // Create webview panel
            const panel = vscode.window.createWebviewPanel(
              "difff.diffView",
              `Diff: ${title}`,
              vscode.ViewColumn.One,
              {
                enableScripts: true,
                retainContextWhenHidden: true,
              },
            );

            // Set up message handling for reload button and comments
            panel.webview.onDidReceiveMessage(
              async (message) => {
                try {
                  if (message.command === "reload") {
                    try {
                      // Show progress notification
                      await vscode.window.withProgress(
                        {
                          location: vscode.ProgressLocation.Notification,
                          title: "Reloading diff...",
                          cancellable: false,
                        },
                        async () => {
                          // Refresh with fresh data from git
                          await refreshWebviewContent(true);
                        },
                      );

                      // Send success message to reset button
                      panel.webview.postMessage({
                        command: "reloadComplete",
                        success: true,
                      });
                    } catch (reloadError: any) {
                      // Send error message to reset button
                      panel.webview.postMessage({
                        command: "reloadComplete",
                        success: false,
                        error: reloadError.message,
                      });

                      vscode.window.showErrorMessage(
                        `Failed to reload diff: ${reloadError.message}`,
                      );
                    }
                  } else if (message.command === "addComment") {
                    const baseRef =
                      mode === "working"
                        ? await gitService.getCurrentCommitHash()
                        : diffExplorerProvider.getBaseRef();
                    const compareRef =
                      mode === "working"
                        ? "working"
                        : diffExplorerProvider.getCompareRef();

                    commentService.addComment(
                      message.filePath,
                      message.lineNumber,
                      message.lineType,
                      message.content,
                      baseRef,
                      compareRef,
                    );

                    // Regenerate webview content instead of reloading
                    await refreshWebviewContent();
                    // Refresh comment explorer
                    commentExplorerProvider.refresh();
                  } else if (message.command === "editComment") {
                    commentService.updateComment(
                      message.commentId,
                      message.content,
                    );
                    await refreshWebviewContent();
                    // Refresh comment explorer
                    commentExplorerProvider.refresh();
                  } else if (message.command === "deleteComment") {
                    const deleted = commentService.deleteComment(
                      message.commentId,
                    );
                    if (deleted) {
                      // Send immediate feedback to webview before refresh
                      panel.webview.postMessage({
                        command: "commentDeleted",
                        commentId: message.commentId,
                      });

                      // Then refresh the content and sidebar
                      await refreshWebviewContent();
                      commentExplorerProvider.refresh();

                      vscode.window.showInformationMessage(
                        "Comment deleted successfully",
                      );
                    } else {
                      vscode.window.showErrorMessage(
                        "Failed to delete comment - comment not found",
                      );
                    }
                  } else if (message.command === "copySingleComment") {
                    const comment = message.comment;
                    const formattedComment =
                      commentTemplateProvider.formatComment(comment);

                    await vscode.env.clipboard.writeText(formattedComment);
                    const template =
                      commentTemplateProvider.getActiveTemplate();
                    vscode.window.showInformationMessage(
                      `Comment copied using "${template?.name || "default"}" template!`,
                    );
                  } else if (message.command === "copyComments") {
                    const baseRef =
                      mode === "working"
                        ? await gitService.getCurrentCommitHash()
                        : diffExplorerProvider.getBaseRef();
                    const compareRef =
                      mode === "working"
                        ? "working"
                        : diffExplorerProvider.getCompareRef();

                    const comments =
                      commentTemplateProvider.copyCommentsWithTemplate(
                        baseRef,
                        compareRef,
                      );

                    await vscode.env.clipboard.writeText(comments);
                    const template =
                      commentTemplateProvider.getActiveTemplate();
                    vscode.window.showInformationMessage(
                      `Comments copied to clipboard using "${template?.name || "default"}" template!`,
                    );
                  }
                } catch (error: any) {
                  vscode.window.showErrorMessage(
                    `Comment operation failed: ${error.message}`,
                  );
                }
              },
              undefined,
              context.subscriptions,
            );

            // Function to refresh webview content
            const refreshWebviewContent = async (shouldRefreshData = false) => {
              try {
                let currentFileDiffs = fileDiffs;

                // If requested, fetch fresh diff data
                if (shouldRefreshData) {
                  if (mode === "working") {
                    const workingFiles =
                      await gitService.getWorkingDirectoryFiles();
                    currentFileDiffs = [];

                    for (const file of workingFiles) {
                      const content =
                        await gitService.getWorkingDirectoryFileDiff(file.path);
                      currentFileDiffs.push({
                        path: file.path,
                        content: content,
                        additions: file.additions,
                        deletions: file.deletions,
                      });
                    }
                  } else {
                    const baseRef = diffExplorerProvider.getBaseRef();
                    const compareRef = diffExplorerProvider.getCompareRef();

                    if (baseRef && compareRef) {
                      const branchFiles = await gitService.getDiffFiles(
                        baseRef,
                        compareRef,
                      );
                      currentFileDiffs = [];

                      for (const file of branchFiles) {
                        const content = await gitService.getFileDiff(
                          baseRef,
                          compareRef,
                          file.path,
                        );
                        currentFileDiffs.push({
                          path: file.path,
                          content: content,
                          additions: file.additions,
                          deletions: file.deletions,
                        });
                      }
                    }
                  }

                  // Update the cached fileDiffs for future comment operations
                  fileDiffs = currentFileDiffs;
                }

                // Get current user info for avatars
                const gitConfig = vscode.workspace.getConfiguration("git");
                const currentUser =
                  gitConfig.get<string>("user.name") ||
                  require("os").userInfo().username ||
                  "User";

                // Get comments for each file
                const commentsMap = new Map<string, any[]>();
                for (const file of currentFileDiffs) {
                  if (mode === "working") {
                    const currentCommitHash =
                      await gitService.getCurrentCommitHash();
                    const fileComments = commentService.getComments(
                      file.path,
                      currentCommitHash,
                      "working",
                    );
                    commentsMap.set(file.path, fileComments);
                  } else {
                    const baseRef = diffExplorerProvider.getBaseRef();
                    const compareRef = diffExplorerProvider.getCompareRef();
                    const fileComments = commentService.getComments(
                      file.path,
                      baseRef,
                      compareRef,
                    );
                    commentsMap.set(file.path, fileComments);
                  }
                }

                // Set webview content
                if (mode === "working") {
                  panel.webview.html =
                    diffWebviewProvider.getWorkingDirectoryContent(
                      currentFileDiffs,
                      commentsMap,
                      currentUser,
                    );
                } else {
                  const baseRef = diffExplorerProvider.getBaseRef();
                  const compareRef = diffExplorerProvider.getCompareRef();
                  panel.webview.html = diffWebviewProvider.getAllDiffsContent(
                    currentFileDiffs,
                    baseRef,
                    compareRef,
                    commentsMap,
                    currentUser,
                  );
                }
              } catch (error: any) {
                vscode.window.showErrorMessage(
                  `Failed to refresh webview: ${error.message}`,
                );
              }
            };

            // Initial content load
            await refreshWebviewContent();
          } catch (error: any) {
            vscode.window.showErrorMessage(
              `Failed to load diffs: ${error.message}`,
            );
          }
        },
      );
    },
  );

  const jumpToCommentCommand = vscode.commands.registerCommand(
    "difff.jumpToComment",
    async (comment: any) => {
      try {
        // Get the mode and refs to determine how to open the diff
        const mode = comment.compareRef === "working" ? "working" : "branch";

        if (mode === "working") {
          // Set working directory mode and view diff
          diffExplorerProvider.setMode("working");
          await vscode.commands.executeCommand("difff.viewDiff");
        } else {
          // Set branch comparison mode with the specific refs
          diffExplorerProvider.setMode("branch");
          await diffExplorerProvider.setRefs(
            comment.baseRef,
            comment.compareRef,
          );
          await vscode.commands.executeCommand("difff.viewDiff");
        }

        // Notify user about the jump
        vscode.window.showInformationMessage(
          `Jumped to comment in ${comment.filePath} at line ${comment.lineNumber}`,
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to jump to comment: ${error.message}`,
        );
      }
    },
  );

  const removeAllCommentsForKeyCommand = vscode.commands.registerCommand(
    "difff.removeAllCommentsForKey",
    async (key: CommentKey) => {
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to remove all ${key.commentCount} comment(s) for "${key.key}"?`,
        { modal: true },
        "Remove All",
        "Cancel",
      );

      if (confirmation === "Remove All") {
        await commentExplorerProvider.removeAllCommentsForKey(key);
        vscode.window.showInformationMessage(
          `Removed all comments for "${key.key}"`,
        );
      }
    },
  );

  const refreshCommentsCommand = vscode.commands.registerCommand(
    "difff.refreshComments",
    () => {
      commentExplorerProvider.refresh();
    },
  );

  const selectTemplateCommand = vscode.commands.registerCommand(
    "difff.selectTemplate",
    async (item?: CommentTemplateItem) => {
      if (item) {
        commentTemplateProvider.setActiveTemplate(item.template.id);
        vscode.window.showInformationMessage(
          `Template "${item.template.name}" is now active`,
        );
      } else {
        await commentTemplateProvider.showTemplateQuickPick();
      }
    },
  );

  const createTemplateCommand = vscode.commands.registerCommand(
    "difff.createTemplate",
    async () => {
      await commentTemplateProvider.createNewTemplate();
    },
  );

  const editTemplateCommand = vscode.commands.registerCommand(
    "difff.editTemplate",
    async (item: CommentTemplateItem) => {
      const newName = await vscode.window.showInputBox({
        prompt: "Enter new template name",
        value: item.template.name,
      });

      if (!newName) return;

      const newTemplate = await vscode.window.showInputBox({
        prompt: "Enter new template format",
        value: item.template.template,
        validateInput: (value) => {
          if (!value) return "Template cannot be empty";
          return null;
        },
      });

      if (!newTemplate) return;

      commentTemplateProvider.editTemplate(
        item.template.id,
        newName,
        newTemplate,
      );
      vscode.window.showInformationMessage(`Template "${newName}" updated`);
    },
  );

  const deleteTemplateCommand = vscode.commands.registerCommand(
    "difff.deleteTemplate",
    async (item: CommentTemplateItem) => {
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete template "${item.template.name}"?`,
        { modal: true },
        "Delete",
        "Cancel",
      );

      if (confirmation === "Delete") {
        commentTemplateProvider.deleteTemplate(item.template.id);
        vscode.window.showInformationMessage(
          `Template "${item.template.name}" deleted`,
        );
      }
    },
  );

  const copyCommentsWithTemplateCommand = vscode.commands.registerCommand(
    "difff.copyCommentsWithTemplate",
    async () => {
      const mode = diffExplorerProvider.getMode();
      let baseRef: string | undefined;
      let compareRef: string | undefined;

      if (mode === "working") {
        baseRef = await gitService.getCurrentCommitHash();
        compareRef = "working";
      } else {
        baseRef = diffExplorerProvider.getBaseRef();
        compareRef = diffExplorerProvider.getCompareRef();
      }

      if (!baseRef || !compareRef) {
        vscode.window.showErrorMessage(
          "Please select branches or set working directory mode first",
        );
        return;
      }

      const comments = commentTemplateProvider.copyCommentsWithTemplate(
        baseRef,
        compareRef,
      );

      if (!comments) {
        vscode.window.showInformationMessage("No comments to copy");
        return;
      }

      await vscode.env.clipboard.writeText(comments);
      const template = commentTemplateProvider.getActiveTemplate();
      vscode.window.showInformationMessage(
        `Comments copied to clipboard using "${template?.name || "default"}" template!`,
      );
    },
  );

  context.subscriptions.push(
    selectModeCommand,
    selectBranchesCommand,
    refreshCommand,
    openFileCommand,
    viewDiffCommand,
    jumpToCommentCommand,
    removeAllCommentsForKeyCommand,
    refreshCommentsCommand,
    selectTemplateCommand,
    createTemplateCommand,
    editTemplateCommand,
    deleteTemplateCommand,
    copyCommentsWithTemplateCommand,
  );
}

export function deactivate() {}
