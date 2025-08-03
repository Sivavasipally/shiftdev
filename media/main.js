(function() {
    const vscode = acquireVsCodeApi();
    
    // Get DOM elements
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const clearButton = document.getElementById('clearChat');
    
    // State management
    let isWaitingForResponse = false;
    
    // Initialize
    initialize();
    
    function initialize() {
        setupEventListeners();
        // Don't restore state here - wait for backend to send history
        // restoreState();
        focusInput();
    }
    
    function setupEventListeners() {
        sendButton.addEventListener('click', sendMessage);
        clearButton.addEventListener('click', clearChat);
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput.addEventListener('input', () => {
            saveState();
        });
        
        // Listen for messages from extension
        window.addEventListener('message', handleMessage);
        
        // Handle clicks on code references
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('clickable-code') || e.target.classList.contains('chunk-reference')) {
                const filePath = e.target.dataset.filePath;
                const lineNumber = parseInt(e.target.dataset.lineNumber);
                
                if (filePath) {
                    vscode.postMessage({
                        type: 'navigateToCode',
                        filePath,
                        lineNumber
                    });
                }
            }
        });
    }
    
    function sendMessage() {
        const content = messageInput.value.trim();
        if (!content || isWaitingForResponse) return;
        
        // Add user message to UI
        addMessage('user', content);
        
        // Clear input
        messageInput.value = '';
        saveState();
        
        // Send to extension
        vscode.postMessage({
            type: 'sendMessage',
            content
        });
        
        // Update state
        isWaitingForResponse = true;
        updateSendButton();
    }
    
    function clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            console.log('Clearing chat - before clear:', messagesContainer.children.length);
            messagesContainer.innerHTML = '';
            console.log('Clearing chat - after clear:', messagesContainer.children.length);
            vscode.postMessage({ type: 'clearChat' });
            console.log('Clear message sent to extension');
        }
    }
    
    function handleMessage(event) {
        const message = event.data;
        
        switch (message.type) {
            case 'messageResponse':
                handleMessageResponse(message);
                break;
            case 'typing':
                handleTypingIndicator(message.isTyping);
                break;
            case 'error':
                handleError(message.message);
                break;
            case 'clearComplete':
                console.log('Received clearComplete from extension');
                console.log('Messages before clearComplete:', messagesContainer.children.length);
                messagesContainer.innerHTML = '';
                console.log('Messages after clearComplete:', messagesContainer.children.length);
                console.log('Chat cleared successfully');
                break;
            case 'loadHistory':
                handleLoadHistory(message.history);
                break;
        }
    }
    
    function handleMessageResponse(message) {
        removeTypingIndicator();
        
        const content = message.content;
        const metadata = message.metadata;
        
        // Add assistant message
        addMessage('assistant', content, metadata);
        
        // Update state
        isWaitingForResponse = false;
        updateSendButton();
        
        saveState();
        focusInput();
    }
    
    function handleTypingIndicator(isTyping) {
        if (isTyping) {
            showTypingIndicator();
        } else {
            removeTypingIndicator();
        }
    }
    
    function handleError(errorMessage) {
        removeTypingIndicator();
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        messagesContainer.appendChild(errorDiv);
        
        // Update state
        isWaitingForResponse = false;
        updateSendButton();
        
        scrollToBottom();
        focusInput();
    }
    
    function handleLoadHistory(history) {
        console.log('Loading chat history:', history.length, 'messages');
        messagesContainer.innerHTML = '';
        
        if (history && history.length > 0) {
            history.forEach(msg => {
                addMessage(msg.role, msg.content, msg.metadata);
            });
        }
        
        // Don't save state here - we're loading from backend
        scrollToBottom();
        focusInput();
    }
    
    function addMessage(role, content, metadata) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'assistant') {
            // Render markdown content
            contentDiv.innerHTML = parseMarkdown(content);
            
            // Handle diagrams with Mermaid
            if (metadata && metadata.isDiagram) {
                setupDiagramInteractivity(contentDiv, metadata);
            }
            
            // Add metadata if available
            if (metadata) {
                const metadataDiv = createMetadataDiv(metadata);
                if (metadataDiv) {
                    messageDiv.appendChild(contentDiv);
                    messageDiv.appendChild(metadataDiv);
                } else {
                    messageDiv.appendChild(contentDiv);
                }
            } else {
                messageDiv.appendChild(contentDiv);
            }
        } else {
            contentDiv.textContent = content;
            messageDiv.appendChild(contentDiv);
        }
        
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function createMetadataDiv(metadata) {
        if (!metadata.retrievedChunks || metadata.retrievedChunks.length === 0) {
            return null;
        }
        
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata-info';
        
        const title = document.createElement('div');
        title.textContent = `Referenced ${metadata.retrievedChunks.length} code chunks:`;
        metadataDiv.appendChild(title);
        
        metadata.retrievedChunks.forEach((chunk, index) => {
            const chunkRef = document.createElement('div');
            chunkRef.className = 'chunk-reference';
            chunkRef.textContent = `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
            chunkRef.dataset.filePath = chunk.filePath;
            chunkRef.dataset.lineNumber = chunk.startLine;
            metadataDiv.appendChild(chunkRef);
        });
        
        if (metadata.tokens) {
            const tokenInfo = document.createElement('div');
            tokenInfo.style.marginTop = '5px';
            tokenInfo.style.fontSize = '10px';
            tokenInfo.textContent = `Tokens: ${metadata.tokens.input} in, ${metadata.tokens.output} out`;
            metadataDiv.appendChild(tokenInfo);
        }
        
        return metadataDiv;
    }
    
    function parseMarkdown(text) {
        // Simple markdown parser - in production, use a proper library like marked.js
        let html = text;
        
        // Code blocks (special handling for Mermaid)
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || '';
            if (language === 'mermaid') {
                return `<div class="mermaid-diagram" data-diagram="${escapeHtml(code.trim())}">${escapeHtml(code.trim())}</div>`;
            }
            return `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
        });
        
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // File references (filename:line_number)
        html = html.replace(/`([^`]+\.(ts|js|py|java|cpp|c|go|rs|php|rb|html|css|json|yaml|yml|md|txt)):(\d+)`/g, 
            '<code class="clickable-code" data-file-path="$1" data-line-number="$3">$1:$3</code>');
        
        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Lists
        html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showTypingIndicator() {
        // Remove existing typing indicator
        removeTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant';
        typingDiv.id = 'typing-indicator';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'typing-indicator';
        
        contentDiv.innerHTML = `
            <span>DevCanvas AI is thinking</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        typingDiv.appendChild(contentDiv);
        messagesContainer.appendChild(typingDiv);
        scrollToBottom();
    }
    
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    function updateSendButton() {
        sendButton.disabled = isWaitingForResponse;
        sendButton.textContent = isWaitingForResponse ? 'Sending...' : 'Send';
    }
    
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function focusInput() {
        if (!isWaitingForResponse) {
            messageInput.focus();
        }
    }
    
    function saveState() {
        const state = {
            inputValue: messageInput.value
            // Don't save messages - they're managed by backend storage
        };
        console.log('Saving state - input only');
        vscode.setState(state);
    }
    
    function restoreState() {
        const state = vscode.getState();
        console.log('Restoring state:', state);
        if (state) {
            messageInput.value = state.inputValue || '';
            // Messages are loaded from backend, not webview state
        } else {
            console.log('No state to restore');
        }
    }
    
    function setupDiagramInteractivity(contentDiv, metadata) {
        // Find mermaid diagrams in the content
        const mermaidDivs = contentDiv.querySelectorAll('.mermaid-diagram');
        
        mermaidDivs.forEach(div => {
            // Replace the text content with rendered Mermaid
            const diagramCode = div.dataset.diagram;
            
            // Create a container for the rendered diagram
            const diagramContainer = document.createElement('div');
            diagramContainer.className = 'diagram-container';
            diagramContainer.innerHTML = `<div class="mermaid">${diagramCode}</div>`;
            
            // Replace the original div
            div.parentNode.replaceChild(diagramContainer, div);
            
            // Set up click handling for navigation
            if (metadata.navigationData) {
                setupDiagramNavigation(diagramContainer, metadata.navigationData);
            }
        });
        
        // Initialize Mermaid if available
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ 
                startOnLoad: true,
                theme: 'default',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                }
            });
            mermaid.init(undefined, contentDiv.querySelectorAll('.mermaid'));
        }
    }
    
    function setupDiagramNavigation(diagramContainer, navigationData) {
        // Handle clicks on diagram elements that have navigation data
        diagramContainer.addEventListener('click', (event) => {
            const target = event.target;
            
            // Look for navigation hints in element attributes or text
            const elementText = target.textContent || target.getAttribute('data-id');
            
            // Check if we have navigation data for this element
            if (elementText && navigationData[elementText]) {
                const navData = navigationData[elementText];
                vscode.postMessage({
                    type: 'navigateToCode',
                    filePath: navData.filePath,
                    lineNumber: navData.lineNumber
                });
                event.preventDefault();
                event.stopPropagation();
            }
        });
        
        // Look for Mermaid click events and handle them
        if (typeof mermaid !== 'undefined') {
            // Custom click handler for Mermaid diagrams
            mermaid.mermaidAPI.setConfig({
                securityLevel: 'loose', // Allow click events
                startOnLoad: true
            });
            
            // Override Mermaid's click handling
            const originalClick = window.mermaidClick;
            window.mermaidClick = function(nodeId) {
                // Extract the navigation identifier from the nodeId
                const navKey = nodeId.replace(/^navigate:/, '');
                
                if (navigationData[navKey]) {
                    const navData = navigationData[navKey];
                    vscode.postMessage({
                        type: 'navigateToCode',
                        filePath: navData.filePath,
                        lineNumber: navData.lineNumber
                    });
                }
                
                // Call original handler if it exists
                if (originalClick) {
                    originalClick(nodeId);
                }
            };
        }
    }
})();