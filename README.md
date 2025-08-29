# Difff - GitHub-like Git Diff Viewer

A Visual Studio Code extension that provides a GitHub-like interface for viewing git diffs with branch/tag/commit selection.

## Features

### Dual Operation Modes

- **Branch Comparison Mode**: Compare any two git references (branches, tags, or commits)
- **Working Directory Mode**: View staged and unstaged changes against HEAD

### User Interface

- **Dual-Panel Activity Bar**: Two dedicated panels - "Git Diff Explorer" and "Comments"
- **Interactive Mode Selectors**: Switch between comparison modes with one click
- **Branch/Reference Selection**: Choose any branches, tags, or commit hashes for comparison
- **File Tree View**: Browse changed files with addition/deletion counts and status icons

### Diff Viewing

- **GitHub-Style Diff Display**: View diffs in a familiar GitHub-style webview interface
- **Progressive Loading**: Files load with progress indication for large diffs
- **Real-time Refresh**: Reload button to update diffs without reopening
- **Fallback Support**: Automatic fallback to VS Code's native diff editor when needed

### Comment Management System

- **Inline Comments**: Add, edit, and delete comments on specific diff lines
- **Comment Explorer**: Dedicated panel to browse and manage all comments
- **Comment Persistence**: Comments saved locally and persist across VS Code sessions
- **Jump Navigation**: Click comments in explorer to jump to their location in diffs
- **Batch Operations**: Remove all comments for specific file/branch combinations
- **Export Comments**: Copy all comments to clipboard for sharing

## Usage

### Getting Started

1. **Access the Extension**: Click the Difff icon in the activity bar to open the dual-panel interface
2. **Choose Operation Mode**: Select between "Branch Comparison" or "Working Directory Changes" in the Git Diff Explorer panel

### Branch Comparison Mode

1. **Select Mode**: Click "Branch Comparison" in the Git Diff Explorer
2. **Choose Base Reference**: Click the "Base" selector and choose your comparison starting point (branch/tag/commit)
3. **Choose Compare Reference**: Click the "Compare" selector and choose what to compare against
4. **View Results**: The diff automatically opens when both references are selected
5. **Browse Files**: Use the tree view to see all changed files with their modification counts

### Working Directory Mode

1. **Select Mode**: Click "Working Directory Changes" in the Git Diff Explorer
2. **Automatic Diff**: The extension immediately shows your staged and unstaged changes vs HEAD
3. **Real-time Updates**: Changes are reflected automatically as you modify files

### Viewing and Interacting with Diffs

- **File Navigation**: Click any file in the tree view to focus on its changes in the main diff view
- **Refresh Data**: Use the refresh button in the toolbar to reload the latest git state
- **Add Comments**: Hover over diff lines to see the "+" button for adding comments
- **Comment Management**: Use the Comments panel to browse, jump to, and manage all your comments

## Installation

### From VS Code Marketplace

Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=knsh14.difff).

### From Source (Development)

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 in VS Code to launch a new Extension Development Host window
5. The extension will be available in the launched window

## GitHub-Style Commenting System

The extension features a comprehensive GitHub Pull Request-style commenting system with full management capabilities:

### Adding Comments

1. **Hover over any diff line** to reveal a **+** button on the left
2. **Click the + button** to open a comment form
3. **Type your comment** in the text area
4. **Click "Comment"** to save your comment
5. **Comments automatically sync** to both diff view and comment explorer

### Comment Display & Interaction

- **Inline Threads**: Comment threads appear as expandable sections below relevant diff lines
- **User Avatars**: Each comment displays the author's initials in a circular avatar
- **Timestamps**: Comments show creation dates in GitHub-style format
- **Edit Mode**: Click "Edit" on any comment to modify its content with inline editing
- **Thread Management**: Click thread headers to expand/collapse entire comment discussions

### Comment Explorer Panel

- **Centralized Management**: Dedicated "Comments" panel in the activity bar sidebar
- **Organized View**: Comments grouped by file and diff context (base → compare)
- **Jump Navigation**: Click any comment to automatically navigate to its location in the diff
- **Batch Operations**: Remove all comments for specific file/branch combinations at once
- **Refresh Control**: Manual refresh button to sync comment display

### Advanced Features

- **Context Awareness**: Comments tied to specific files, lines, diff contexts, and git references
- **Export Functionality**: Copy all comments to clipboard in readable format for sharing
- **Persistent Storage**: Comments saved in VS Code workspace storage, persist across sessions
- **Multi-Mode Support**: Comments work in both Branch Comparison and Working Directory modes
- **User Integration**: Automatically detects and uses your Git username for attribution

### Comment Management Workflow

1. **Browse Comments**: Use the Comments panel to see all your annotations across different comparisons
2. **Quick Navigation**: Click any comment in the explorer to jump directly to its diff location
3. **Bulk Cleanup**: Use the trash icon next to file/branch groups to remove multiple comments
4. **Export & Share**: Use "Copy Comments" button in diff view to export all comments for the current comparison

## Architecture Overview

Difff uses a sophisticated dual-panel architecture optimized for git diff workflows:

### Core Components

- **Extension Host** (`extension.ts`): Coordinates all functionality and manages VS Code integration
- **Git Service** (`gitService.ts`): Handles all git operations using the `simple-git` library
- **Diff Explorer** (`diffExplorer.ts`): Manages the tree view with mode selectors and file navigation
- **Comment System**:
  - **Comment Service** (`commentService.ts`): Manages comment storage, CRUD operations, and persistence
  - **Comment Explorer** (`commentExplorer.ts`): Provides the comment management UI panel
- **Webview Provider** (`webviewProvider.ts`): Generates GitHub-style HTML for diff rendering

### Dual-Panel Interface

**Git Diff Explorer Panel**:

- Mode selection (Branch Comparison vs Working Directory)
- Branch/reference selectors (in Branch Comparison mode)
- Changed files tree with modification counts
- Toolbar with refresh and compare actions

**Comments Panel**:

- Hierarchical view of all comments grouped by file/context
- Jump-to-comment navigation
- Batch comment management with delete operations
- Refresh control for comment synchronization

### Operation Modes

**Branch Comparison Mode**:

- Compares any two git references (branches, tags, commits)
- Shows diff between the selected base and compare references
- Supports full git reference history including recent commits

**Working Directory Mode**:

- Shows staged and unstaged changes vs HEAD
- Auto-refreshes as files are modified
- Simpler workflow for reviewing current work

### Data Flow

1. User selects mode and references through the tree view
2. Git Service fetches diff data using simple-git
3. Webview Provider generates GitHub-style HTML with diff rendering
4. Comment Service overlays any existing comments for the current context
5. User interactions (comments, navigation) flow back through message passing
6. All comment data persists in VS Code workspace storage

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

## Project Structure

```
difff/
├── src/
│   ├── extension.ts          # Main extension entry point and command coordination
│   ├── diffExplorer.ts       # Tree view provider with mode and branch selectors
│   ├── gitService.ts         # Git operations using simple-git library
│   ├── webviewProvider.ts    # GitHub-style HTML generation for diff rendering
│   ├── commentService.ts     # Comment CRUD operations and persistence management
│   └── commentExplorer.ts    # Comment tree view provider for management panel
├── resources/
│   └── diff-icon.svg         # Activity bar icon for the extension
├── out/                      # Compiled JavaScript output (generated)
├── package.json              # Extension manifest, commands, and contribution points
├── tsconfig.json            # TypeScript configuration
└── README.md                # This documentation
```

## Extension Commands

The extension provides the following commands accessible through the Command Palette (`Ctrl+Shift+P`):

### Core Diff Commands

- `difff.selectMode` - Switch between Branch Comparison and Working Directory modes
- `difff.selectBranches` - Open branch/tag/commit selection dialog
- `difff.viewDiff` - Open the main diff view with current configuration
- `difff.refresh` - Refresh diff data and tree view
- `difff.openFile` - Open individual file diff (used internally by tree view)

### Comment Management Commands

- `difff.jumpToComment` - Navigate to a specific comment's location in the diff
- `difff.refreshComments` - Refresh the comment explorer panel
- `difff.removeAllCommentsForKey` - Remove all comments for a file/context combination

### UI Integration

- Activity bar icon provides access to both Git Diff Explorer and Comments panels
- Tree view context menus for file operations and comment management
- Webview integration with message passing for real-time comment operations

## Requirements

- VS Code 1.74.0 or higher
- Git must be installed and accessible from the command line
- The workspace must be a git repository

## Known Issues

- The extension currently requires the workspace to be a git repository
- Large diffs may take time to load in the webview

## Contributing

Contributions are welcome! Please feel free to submit pull requests or create issues for bugs and feature requests.
