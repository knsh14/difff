# Difff - GitHub-like Git Diff Viewer

A Visual Studio Code extension that provides a GitHub-like interface for viewing git diffs with branch/tag/commit selection.

## Features

- **Activity Bar Icon**: Access the diff viewer from the activity bar
- **Branch/Tag/Commit Selection**: Compare any two references (branches, tags, or commits)
- **Tree View**: Browse changed files in a tree structure with addition/deletion counts
- **GitHub-like Diff Display**: View diffs in a familiar GitHub-style interface
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