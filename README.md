# Brainrot Comment Extension

generate brainrot comments that will roast the quality of your code

for claude builder club hackathon

## ai slop below:

## Installation

### From Source

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile TypeScript:
   ```bash
   npm run compile
   ```

3. Press `F5` in VS Code to launch Extension Development Host and test the extension

### Package Extension

1. Install vsce (VS Code Extension manager):
   ```bash
   npm install -g vsce
   ```

2. Package the extension:
   ```bash
   vsce package
   ```

3. Install the generated `.vsix` file via VS Code's Extensions view

## Usage

1. Place your cursor on any line in any file
2. Press `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)
3. The comment will be inserted at the beginning of the line (preserving indentation)

## Requirements

- VS Code 1.74.0 or higher
- Node.js 14 or higher

## Development

- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode for development

