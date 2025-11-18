import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Gets the appropriate comment syntax for a given language ID
 */
function getCommentSyntax(languageId: string): string {
  const commentMap: { [key: string]: string } = {
    // Single-line comments
    'javascript': '//',
    'typescript': '//',
    'javascriptreact': '//',
    'typescriptreact': '//',
    'c': '//',
    'cpp': '//',
    'csharp': '//',
    'java': '//',
    'go': '//',
    'rust': '//',
    'swift': '//',
    'kotlin': '//',
    'dart': '//',
    'scala': '//',
    
    // Hash comments
    'python': '#',
    'shellscript': '#',
    'bash': '#',
    'ruby': '#',
    'perl': '#',
    'yaml': '#',
    'yml': '#',
    'dockerfile': '#',
    'r': '#',
    'lua': '--',
    'sql': '--',
    
    // HTML/XML comments
    'html': '<!--',
    'xml': '<!--',
    
    // CSS comments
    'css': '/*',
    'scss': '//',
    'sass': '//',
    'less': '//',
  };

  return commentMap[languageId] || '//';
}

/**
 * Gets the closing comment syntax if needed (for multi-line comments)
 */
function getCommentClosing(languageId: string): string {
  if (languageId === 'html' || languageId === 'xml') {
    return ' -->';
  }
  if (languageId === 'css') {
    return ' */';
  }
  return '';
}

const API_KEY_SECRET_KEY = 'brainrot.claudeApiKey';

/**
 * Gets the Anthropic API key from VS Code secret storage
 */
async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  try {
    const apiKey = await context.secrets.get(API_KEY_SECRET_KEY);
    return apiKey && apiKey.trim() !== '' ? apiKey : undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Sets the Anthropic API key in VS Code secret storage
 */
async function setApiKey(context: vscode.ExtensionContext): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Anthropic Claude API Key',
    placeHolder: 'sk-ant-...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'API key cannot be empty';
      }
      if (!value.startsWith('sk-ant-')) {
        return 'API key should start with "sk-ant-"';
      }
      return null;
    }
  });

  if (apiKey) {
    try {
      await context.secrets.store(API_KEY_SECRET_KEY, apiKey.trim());
      vscode.window.showInformationMessage('Claude API key saved successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
    }
  }
}

/**
 * Extracts code context from the editor selections
 * Returns the selected code text, limited to a reasonable size
 */
function extractCodeContext(editor: vscode.TextEditor): string {
  const document = editor.document;
  const maxContextLength = 2000;
  
  let contextText = '';
  
  editor.selections.forEach((selection) => {
    if (!selection.isEmpty) {
      // Get selected text
      const selectedText = document.getText(selection);
      if (contextText.length + selectedText.length <= maxContextLength) {
        contextText += (contextText ? '\n\n' : '') + selectedText;
      }
    } else {
      // If no selection, get the current line
      const line = selection.active.line;
      const lineText = document.lineAt(line).text.trim();
      if (lineText && contextText.length + lineText.length <= maxContextLength) {
        contextText += (contextText ? '\n\n' : '') + lineText;
      }
    }
  });
  
  // If still no context, get a few lines around the cursor
  if (!contextText && editor.selections.length > 0) {
    const firstSelection = editor.selections[0];
    const line = firstSelection.active.line;
    const startLine = Math.max(0, line - 2);
    const endLine = Math.min(document.lineCount - 1, line + 2);
    
    for (let i = startLine; i <= endLine; i++) {
      const lineText = document.lineAt(i).text;
      if (contextText.length + lineText.length <= maxContextLength) {
        contextText += (contextText ? '\n' : '') + lineText;
      }
    }
  }
  
  return contextText || 'code';
}

/**
 * Generates a brainrot comment using Claude API based on the code context
 */
async function generateBrainrotComment(codeContext: string, language: string, context: vscode.ExtensionContext): Promise<string> {
  const apiKey = await getApiKey(context);
  
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please run "Brainrot: Set Claude API Key" command to set your API key.');
  }
  
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });
  
  const prompt = `You are a gen z software engineer that generates short, sarcastic, and sometimes mean brainrot-style given a code snippet. 

A "brainrot" comment is:
- Very short (ideally 1-10 words)
- Sarcastic, mean, or absurd
- Contextually relevant to the code

Here are some examples of brainrot comments:
- "we got O(n^2) loops before GTA 6"
- "why this token validation looking kinda sus"
- "wait... hol up this ain't bussin at all"

Generate a brainrot comment for this ${language} code:

\`\`\`${language}
${codeContext}
\`\`\`

Return ONLY the comment text itself, without any code comment syntax (no //, #, etc.). Just the raw text that would go inside a comment.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 50,
      temperature: 1,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text.trim() 
      : '';
    
    if (!responseText) {
      throw new Error('Empty response from Claude API');
    }
    
    // Limit the response to 50 words max
    const words = responseText.split(/\s+/);
    const limitedText = words.slice(0, 50).join(' ');
    
    return limitedText;
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key. Please run "Brainrot: Set Claude API Key" command to update your API key.');
    } else if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (error.message) {
      throw new Error(`API error: ${error.message}`);
    } else {
      throw new Error('Failed to generate comment. Please check your API key and try again.');
    }
  }
}

/**
 * Inserts a brainrot comment at the beginning of the current line
 */
async function addBrainrotComment(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showWarningMessage('No active editor found');
    return;
  }

  const document = editor.document;
  const languageId = document.languageId;
  const commentSyntax = getCommentSyntax(languageId);
  const commentClosing = getCommentClosing(languageId);
  
  // Show loading indicator
  const progressOptions: vscode.ProgressOptions = {
    location: vscode.ProgressLocation.Notification,
    title: 'Generating brainrot comment...',
    cancellable: false
  };
  
  let commentText: string;
  
  try {
    // Extract code context
    const codeContext = extractCodeContext(editor);
    
    // Generate comment with progress indicator
    commentText = await vscode.window.withProgress(progressOptions, async () => {
      return await generateBrainrotComment(codeContext, languageId, context);
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to generate comment';
    vscode.window.showErrorMessage(`Brainrot Comment: ${errorMessage}`);
    
    // Fallback to hardcoded comment
    commentText = 'Brainrot comment';
  }
  
  const fullComment = `${commentSyntax} ${commentText}${commentClosing}`;

  await editor.edit((editBuilder: vscode.TextEditorEdit) => {
    editor.selections.forEach((selection: vscode.Selection) => {
      const line = selection.active.line;
      const lineText = document.lineAt(line).text;
      
      // Find the indentation of the current line
      const indentationMatch = lineText.match(/^(\s*)/);
      const indentation = indentationMatch ? indentationMatch[1] : '';
      
      // Calculate the position at the beginning of the line (after indentation)
      const lineStart = new vscode.Position(line, 0);
      const insertPosition = new vscode.Position(line, indentation.length);
      
      // Insert the comment
      editBuilder.insert(insertPosition, fullComment);
    });
  });
}

export function activate(context: vscode.ExtensionContext) {
  const addCommentDisposable = vscode.commands.registerCommand('brainrot.addComment', () => addBrainrotComment(context));
  const setApiKeyDisposable = vscode.commands.registerCommand('brainrot.setApiKey', () => setApiKey(context));
  
  context.subscriptions.push(addCommentDisposable);
  context.subscriptions.push(setApiKeyDisposable);
}

export function deactivate() {}

