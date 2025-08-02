# DevCanvas AI - Troubleshooting Guide

## Common Issues and Solutions

### ✅ **FIXED: Configuration Errors**

**Issue 1**: `Unable to write to User Settings because devcanvas.devcanvas.userProfile is not a registered configuration`
- **Cause**: Double-prefixing of configuration keys
- **Solution**: ✅ Fixed by using correct configuration key names

**Issue 2**: `Cannot set properties of undefined (setting 'gemini-flash')`
- **Cause**: `userProfile.apiKeys` object was undefined when loading from VS Code settings
- **Solution**: ✅ Fixed by ensuring `apiKeys` object exists before assignment

**Issue 3**: `API key not configured for undefined` during auto-indexing
- **Cause**: Extension trying to auto-index before user configures API keys
- **Solution**: ✅ Fixed by checking API key configuration before auto-indexing

**Issue 4**: `Request failed with status code 401` (OpenAI embedding error)
- **Cause**: Wrong API being used for embeddings (e.g., using OpenAI API with Gemini key)
- **Solution**: ✅ Fixed by routing embeddings to match the selected LLM provider

**Issue 5**: README generation returns "code context is empty"
- **Cause**: Either indexing failed or search queries not finding relevant chunks
- **Solution**: ✅ Enhanced search logic and added debugging + fallback queries

**Technical Details**:
- Added safety checks for `userProfile.apiKeys` initialization
- Enhanced error handling in configuration panel
- Proper user profile creation when none exists
- Skip auto-indexing when no API keys are configured
- Update user profile in active components after configuration
- Better error messages for missing API key configuration

---

## Other Potential Issues

### 🔧 **SQLite Experimental Warning**

**Issue**: `(node:13360) ExperimentalWarning: SQLite is an experimental feature`

**Cause**: VS Code or Node.js using experimental SQLite features

**Solution**: This is just a warning and doesn't affect functionality. Can be ignored.

---

### 🔑 **API Key Configuration**

**Issue**: Extension starts but can't access LLM APIs

**Solution**:
1. Run command: `DevCanvas AI: Configure API Keys`
2. Select your LLM provider
3. Enter a valid API key
4. Test with a simple query

**Valid API Key Sources**:
- **Google Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Anthropic**: [Anthropic Console](https://console.anthropic.com/)

---

### 📁 **Workspace Indexing Issues**

**Issue**: "No code has been indexed yet" message

**Solution**:
1. Open a folder/workspace with code files
2. Run command: `DevCanvas AI: Index Current Workspace`
3. Wait for indexing to complete
4. Check for `.vscode/chunks.json` file creation

---

### 🔍 **Extension Not Visible in Sidebar**

**Issue**: DevCanvas AI icon not showing in VS Code sidebar

**Solution**:
1. Check VS Code version (requires 1.80.0+)
2. Look for "DevCanvas AI" in the Explorer sidebar
3. If missing, try reloading VS Code window (`Ctrl+Shift+P` → "Reload Window")

---

### 💾 **Storage Issues**

**Issue**: Chat history or index data not persisting

**Solution**:
1. Check workspace permissions (write access to `.vscode/` folder)
2. Ensure VS Code has proper file system permissions
3. Try clearing index and re-indexing: `DevCanvas AI: Clear Index`

---

### 🌐 **Network/API Issues**

**Issue**: API calls failing or timing out

**Solutions**:
1. **Check internet connection**
2. **Verify API key validity**
3. **Check API rate limits**:
   - Google Gemini: 60 requests/minute
   - OpenAI: Varies by plan
   - Anthropic: Varies by plan
4. **Firewall/Proxy**: Ensure VS Code can make HTTPS requests

---

### 🐛 **Development Issues**

**Issue**: Extension not loading in development mode

**Solution**:
1. Ensure all dependencies installed: `npm install`
2. Compile TypeScript: `npm run compile`
3. Check for compilation errors
4. Press `F5` in VS Code with extension project open
5. Check Developer Console for errors (`Help` → `Toggle Developer Tools`)

---

### 📦 **Package/Installation Issues**

**Issue**: Extension package creation fails

**Solution**:
1. Install vsce globally: `npm install -g @vscode/vsce`
2. Ensure all required fields in `package.json`
3. Run: `npx vsce package`
4. Check for missing files or dependencies

---

## Getting Help

### 🔍 **Debug Information**

When reporting issues, include:
1. **VS Code version**: `Help` → `About`
2. **Node.js version**: `node --version`
3. **Extension version**: Check in Extensions panel
4. **Error messages**: From Developer Console
5. **Steps to reproduce**: Detailed reproduction steps

### 📞 **Support Channels**

1. **GitHub Issues**: [Report bugs and feature requests]
2. **Developer Console**: `Help` → `Toggle Developer Tools` → `Console` tab
3. **VS Code Output Panel**: `View` → `Output` → Select "DevCanvas AI"

---

## Performance Tips

### ⚡ **Optimization**

1. **Large Codebases**:
   - Index only relevant directories
   - Use `.gitignore` to exclude unnecessary files
   - Consider chunking large files

2. **API Usage**:
   - Use Gemini Flash for faster responses
   - Batch questions when possible
   - Monitor API usage and rate limits

3. **Storage**:
   - Regularly clear old indexes if workspace changes significantly
   - Monitor `.vscode/chunks.json` file size

---

**Status**: Ready for use with common issues resolved ✅