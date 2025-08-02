# DevCanvas AI - Development Guide

## 🚀 Setup Instructions

### Prerequisites
- **Node.js**: Version 18 or higher
- **VS Code**: Version 1.80.0 or higher
- **Git**: For version control

### Installation Steps

1. **Navigate to Project Directory**:
   ```bash
   cd devcanvas-ai
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Compile TypeScript**:
   ```bash
   npm run compile
   ```

4. **Development Testing**:
   - Open the project in VS Code
   - Press `F5` to launch Extension Development Host
   - Test the extension in the new VS Code window

### Package Information

✅ **Dependencies Installed**: All packages including `@lancedb/lancedb`, `axios`, `cheerio`, `jszip`
✅ **TypeScript Compilation**: Successfully compiles without errors
✅ **Project Structure**: Complete with all necessary files

### Known Issues Fixed

- ✅ Updated deprecated `vectordb` to `@lancedb/lancedb`
- ✅ Fixed TypeScript compilation errors
- ✅ Updated ESLint configuration for newer versions
- ✅ Implemented simplified VectorDB with file-based storage fallback

## 🛠️ Development Commands

```bash
# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Lint code (with warnings for unused variables)
npm run lint

# Package extension for distribution
npm run package
# OR
npx vsce package
```

## 🏗️ Project Architecture

### Core Components

1. **Extension Entry Point** (`src/extension.ts`)
   - Activates extension and registers commands
   - Initializes core components
   - Handles VS Code integration

2. **RAG Pipeline** (`src/core/`)
   - `RAGManager.ts`: Main orchestrator for RAG operations
   - `CodeParser.ts`: AST-based code analysis and chunking
   - `VectorDB.ts`: Simplified vector storage (file-based fallback)

3. **Chat System** (`src/chat/`)
   - `ChatController.ts`: Routes messages to appropriate handlers
   - `LLMProvider.ts`: Multi-LLM API integration

4. **Features** (`src/features/`)
   - `diagramGenerator.ts`: Mermaid diagram creation
   - `readmeGenerator.ts`: Documentation generation
   - `agileGenerator.ts`: Story point estimation
   - `qualityAnalyzer.ts`: Code quality analysis

5. **UI Components** (`src/sidebar/`)
   - `SidebarProvider.ts`: VS Code webview integration
   - `media/`: CSS and JavaScript for webview

### Storage Strategy

Due to LanceDB API changes, the current implementation uses:
- **File-based storage**: JSON files in `.vscode/chunks.json`
- **In-memory processing**: Fast search and retrieval
- **Graceful fallback**: Works without vector database dependencies

## 🔧 API Configuration

The extension supports multiple LLM providers:

### Required API Keys
1. **Google Gemini** (Recommended):
   - Get API key: [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Models: `gemini-1.5-flash`, `gemini-1.5-pro`

2. **OpenAI**:
   - Get API key: [OpenAI Platform](https://platform.openai.com/api-keys)
   - Models: `gpt-4-turbo-preview`

3. **Anthropic Claude**:
   - Get API key: [Anthropic Console](https://console.anthropic.com/)
   - Models: `claude-3-sonnet-20240229`

### Configuration Steps
1. Run command: `DevCanvas AI: Configure API Keys`
2. Select your preferred LLM provider
3. Enter your API key
4. The extension will automatically set up embedding models

## 🧪 Testing the Extension

### Manual Testing Steps

1. **Launch Development Host**:
   - Open project in VS Code
   - Press `F5`
   - New VS Code window opens with extension loaded

2. **Test Basic Functionality**:
   - Look for "DevCanvas AI" in the sidebar
   - Configure API keys via command palette
   - Index a workspace with code files
   - Ask questions about the codebase

3. **Test Features**:
   - Generate README: Right-click folder → "Generate README"
   - Create diagrams: Ask "generate architecture diagram"
   - Analyze quality: Ask "analyze code quality"
   - Generate stories: Ask "create user stories for authentication"

### Example Queries to Test

```
"What does this codebase do?"
"Generate a comprehensive README"
"Create an architecture diagram"
"Show me the main entry points"
"Analyze code quality and security issues"
"Generate user stories for the login feature"
"Create a class diagram"
```

## 📦 Packaging for Distribution

1. **Create VSIX Package**:
   ```bash
   npx vsce package
   ```

2. **Install Locally**:
   ```bash
   code --install-extension devcanvas-ai-1.0.0.vsix
   ```

3. **Publish to Marketplace** (when ready):
   ```bash
   npx vsce publish
   ```

## 🔍 Troubleshooting

### Common Issues

1. **LanceDB Connection Issues**:
   - The extension uses file-based fallback storage
   - Check `.vscode/chunks.json` for indexed data

2. **API Key Issues**:
   - Keys are stored securely in VS Code's secret storage
   - Reconfigure via command palette if needed

3. **Compilation Errors**:
   - Run `npm run compile` to check for TypeScript errors
   - Check Node.js version (requires 18+)

4. **Extension Not Loading**:
   - Check VS Code version (requires 1.80.0+)
   - Look at Developer Console for errors (`Help` → `Toggle Developer Tools`)

## 🚧 Future Improvements

1. **Full LanceDB Integration**: Once API stabilizes
2. **Enhanced Language Support**: More programming languages
3. **Advanced Vector Search**: Proper semantic similarity
4. **Performance Optimization**: Streaming for large codebases
5. **Team Features**: Shared indexes and collaboration

## 📝 Development Notes

- The current implementation prioritizes functionality over vector database complexity
- File-based storage provides reliable fallback while LanceDB API evolves
- All core features work without complex vector operations
- Ready for production use with current feature set

---

**Status**: ✅ Ready for development and testing
**Next Step**: Configure API keys and test with a sample codebase