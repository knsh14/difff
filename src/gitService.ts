import * as vscode from "vscode";
import simpleGit, { SimpleGit, DiffResult } from "simple-git";

export class GitService {
  private git: SimpleGit;

  constructor() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }
    this.git = simpleGit(workspaceFolder.uri.fsPath);
  }

  async getAllRefs(): Promise<string[]> {
    try {
      const refs: string[] = [];

      // Add HEAD
      refs.push("HEAD");

      // Get branches
      try {
        const branches = await this.git.branch(["-a"]);

        // Add local branches
        Object.keys(branches.branches).forEach((branch) => {
          if (!branch.startsWith("remotes/")) {
            if (!refs.includes(branch)) {
              refs.push(branch);
            }
          }
        });

        // Add remote branches
        Object.keys(branches.branches).forEach((branch) => {
          if (branch.startsWith("remotes/")) {
            const cleanBranch = branch
              .replace("remotes/origin/", "")
              .replace("remotes/", "");
            if (!refs.includes(cleanBranch) && cleanBranch !== "HEAD") {
              refs.push(`origin/${cleanBranch}`);
            }
          }
        });
      } catch (err) {
        console.log("Could not get branches:", err);
      }

      // Get tags
      try {
        const tags = await this.git.tags();
        tags.all.forEach((tag) => {
          refs.push(`tag/${tag}`);
        });
      } catch (err) {
        console.log("Could not get tags:", err);
      }

      // Get recent commits
      try {
        const log = await this.git.log({ maxCount: 20 });
        log.all.slice(0, 10).forEach((commit) => {
          const shortMessage = commit.message.split("\n")[0].substring(0, 50);
          refs.push(`${commit.hash.substring(0, 7)} - ${shortMessage}`);
        });
      } catch (err) {
        console.log("Could not get commits:", err);
      }

      // Remove duplicates and empty values
      const uniqueRefs = [...new Set(refs)].filter((ref) => ref && ref.trim());

      // If no refs found, return defaults
      if (uniqueRefs.length === 0) {
        return ["HEAD"];
      }

      return uniqueRefs;
    } catch (error) {
      console.error("Error getting refs:", error);
      return ["HEAD"];
    }
  }

  async getDiff(baseRef: string, compareRef: string): Promise<DiffResult> {
    try {
      const base = this.parseRef(baseRef);
      const compare = this.parseRef(compareRef);
      const diff = await this.git.diff([
        `${base}...${compare}`,
        "--name-status",
      ]);
      return await this.git.diffSummary([`${base}...${compare}`]);
    } catch (error) {
      console.error("Error getting diff:", error);
      throw error;
    }
  }

  async getFileDiff(
    baseRef: string,
    compareRef: string,
    filePath: string,
  ): Promise<string> {
    try {
      const base = this.parseRef(baseRef);
      const compare = this.parseRef(compareRef);
      return await this.git.diff([`${base}...${compare}`, "--", filePath]);
    } catch (error) {
      console.error("Error getting file diff:", error);
      return "";
    }
  }

  async getDiffFiles(
    baseRef: string,
    compareRef: string,
  ): Promise<
    Array<{
      path: string;
      status: string;
      additions: number;
      deletions: number;
    }>
  > {
    try {
      const base = this.parseRef(baseRef);
      const compare = this.parseRef(compareRef);
      const diffSummary = await this.git.diffSummary([`${base}...${compare}`]);

      return diffSummary.files.map((file) => ({
        path: file.file,
        status: this.getFileStatus(file),
        additions: ("insertions" in file ? file.insertions : 0) || 0,
        deletions: ("deletions" in file ? file.deletions : 0) || 0,
      }));
    } catch (error) {
      console.error("Error getting diff files:", error);
      return [];
    }
  }

  private parseRef(ref: string): string {
    if (ref.includes(" - ")) {
      return ref.split(" - ")[0];
    }
    if (ref.startsWith("tag/")) {
      return ref;
    }
    return ref;
  }

  private parseShortStatus(status: string): string {
    // Git status --short format: XY filename
    // X = staged status, Y = working tree status
    // ' ' = unmodified, M = modified, A = added, D = deleted, R = renamed, C = copied, U = updated but unmerged, ? = untracked, ! = ignored

    const stagedStatus = status[0];
    const workingTreeStatus = status[1];

    if (stagedStatus === "?" && workingTreeStatus === "?") {
      return "untracked";
    }

    if (stagedStatus === "A" || workingTreeStatus === "A") {
      return "added";
    }

    if (stagedStatus === "D" || workingTreeStatus === "D") {
      return "deleted";
    }

    if (stagedStatus === "R" || workingTreeStatus === "R") {
      return "renamed";
    }

    if (stagedStatus === "M" || workingTreeStatus === "M") {
      return "modified";
    }

    if (stagedStatus === "C" || workingTreeStatus === "C") {
      return "copied";
    }

    return "modified"; // fallback
  }

  private getFileStatus(file: any): string {
    if (file.binary) return "binary";
    const deletions = "deletions" in file ? file.deletions : 0;
    const insertions = "insertions" in file ? file.insertions : 0;
    if (deletions === 0 && insertions > 0) return "added";
    if (insertions === 0 && deletions > 0) return "deleted";
    return "modified";
  }

  async getWorkingDirectoryDiff(): Promise<string> {
    try {
      // Get diff for staged and unstaged changes
      const stagedDiff = await this.git.diff(["--staged"]);
      const unstagedDiff = await this.git.diff();

      // Combine both diffs
      return stagedDiff + "\n" + unstagedDiff;
    } catch (error) {
      console.error("Error getting working directory diff:", error);
      return "";
    }
  }

  async getWorkingDirectoryFiles(): Promise<
    Array<{
      path: string;
      status: string;
      additions: number;
      deletions: number;
    }>
  > {
    try {
      // Use git status --short for more efficient parsing
      const shortStatus = await this.git.raw(["status", "--short"]);
      const files: Array<{
        path: string;
        status: string;
        additions: number;
        deletions: number;
      }> = [];

      // Parse each line of git status --short output
      const lines = shortStatus.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        if (line.length < 3) continue; // Skip invalid lines

        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3); // Skip the space after status code
        const fileStatus = this.parseShortStatus(statusCode);

        // Get diff stats for the file
        let additions = 0;
        let deletions = 0;

        try {
          // Only get diff stats for tracked files (not untracked)
          if (fileStatus !== "untracked") {
            const fileDiff = await this.getWorkingDirectoryFileDiff(filePath);
            const diffLines = fileDiff.split("\n");
            for (const diffLine of diffLines) {
              if (diffLine.startsWith("+") && !diffLine.startsWith("+++"))
                additions++;
              if (diffLine.startsWith("-") && !diffLine.startsWith("---"))
                deletions++;
            }
          } else {
            // For untracked files, we could count lines in the file as additions
            // but for now, we'll leave them as 0/0 to be consistent with git behavior
          }
        } catch (err) {
          // If we can't get diff stats, use defaults (0/0)
          console.warn(`Could not get diff stats for ${filePath}:`, err);
        }

        files.push({
          path: filePath,
          status: fileStatus,
          additions,
          deletions,
        });
      }

      return files;
    } catch (error) {
      console.error("Error getting working directory files:", error);
      return [];
    }
  }

  async getWorkingDirectoryFileDiff(filePath: string): Promise<string> {
    try {
      // Try to get staged diff first, then unstaged
      const stagedDiff = await this.git.diff(["--staged", "--", filePath]);
      const unstagedDiff = await this.git.diff(["--", filePath]);

      // Combine both diffs
      let combinedDiff = "";
      if (stagedDiff.trim()) {
        combinedDiff += stagedDiff;
      }
      if (unstagedDiff.trim()) {
        if (combinedDiff) combinedDiff += "\n";
        combinedDiff += unstagedDiff;
      }

      return combinedDiff;
    } catch (error) {
      console.error("Error getting working directory file diff:", error);
      return "";
    }
  }

  async getCurrentCommitHash(): Promise<string> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash || "HEAD";
    } catch (error) {
      console.error("Error getting current commit hash:", error);
      return "HEAD";
    }
  }
}
