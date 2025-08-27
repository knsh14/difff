# Difff - GitHub-like Git Diff Viewer

A Visual Studio Code extension that provides a GitHub-like interface for viewing git diffs with branch/tag/commit selection.

## Features

- **Activity Bar Icon**: Access the diff viewer from the activity bar
- **Branch/Tag/Commit Selection**: Compare any two references (branches, tags, or commits)
- **Tree View**: Browse changed files in a tree structure with addition/deletion counts
- **GitHub-like Diff Display**: View diffs in a familiar GitHub-style interface
- **Inline Comments**: Add, edit, and delete comments on specific diff lines like GitHub
- **Comment Persistence**: Comments are saved locally and persist across VS Code sessions
- **Native VS Code Diff**: Open diffs directly in VS Code's native diff editor

## Usage

1. Click on the Difff icon in the activity bar
2. Click the compare button (git icon) in the tree view toolbar
3. Select the base reference (branch/tag/commit to compare from)
4. Select the compare reference (branch/tag/commit to compare to)
5. Browse changed files in the tree view
6. Click any file to view its diff

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 in VS Code to launch a new Extension Development Host window
5. The extension will be available in the launched window

## GitHub-Style Commenting

The extension now features a GitHub Pull Request-style commenting system:

### Adding Comments

1. **Hover over any diff line** to reveal a **+** button on the left
2. **Click the + button** to open a comment form
3. **Type your comment** in the text area
4. **Click "Comment"** to save your comment

### Managing Comments

- **View Comments**: Comment threads appear as expandable sections below the relevant lines
- **User Avatars**: Each comment shows the author's initials in a circular avatar
- **Timestamps**: Comments display creation dates in GitHub format
- **Edit Comments**: Click "Edit" on any comment to modify its content inline
- **Delete Comments**: Click "Delete" to permanently remove comments
- **Collapse Threads**: Click the thread header to expand/collapse comment discussions

### Features

- **Persistent Storage**: Comments are saved locally and persist across VS Code sessions
- **Context Awareness**: Comments are tied to specific files, lines, and diff contexts
- **GitHub-Style UI**: Familiar interface matching GitHub's PR commenting experience
- **User Integration**: Automatically uses your Git username for comment attribution

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run linter
npm run lint
```

## Requirements

- VS Code 1.74.0 or higher
- Git must be installed and accessible from the command line
- The workspace must be a git repository

## Known Issues

- The extension currently requires the workspace to be a git repository
- Large diffs may take time to load in the webview

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.
