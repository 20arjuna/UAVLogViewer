<template>
  <div>
    <!-- Toggle Button (floating) -->
    <div
      v-if="!isOpen"
      class="chat-toggle-btn"
      @click="toggleChat"
      title="Open AI Assistant (Ctrl+K)"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </div>

    <!-- Chat Panel (overlay) -->
    <transition name="slide">
      <div v-if="isOpen" class="chat-panel">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Flight Log Assistant</span>
          </div>
          <button class="chat-close-btn" @click="toggleChat" title="Close (Esc)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <div class="chat-messages" ref="messagesContainer">
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['chat-message', message.role]"
          >
            <div class="message-bubble">
              <div class="message-content" v-html="formatMessage(message.content)"></div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="isLoading" class="chat-message assistant">
            <div class="message-bubble loading">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="chat-input-container">
          <textarea
            v-model="currentMessage"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.esc="toggleChat"
            placeholder="Ask about your flight log..."
            class="chat-input"
            rows="1"
            :disabled="isLoading"
          ></textarea>
          <button
            @click="sendMessage"
            class="send-btn"
            :disabled="!currentMessage.trim() || isLoading"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { marked } from 'marked'

export default {
    name: 'ChatBot',
    data () {
        return {
            isOpen: false,
            currentMessage: '',
            messages: [],
            isLoading: false,
            sessionId: null
        }
    },
    mounted () {
        // Generate or restore session ID
        this.sessionId = sessionStorage.getItem('chatSessionId')
        if (!this.sessionId) {
            this.sessionId = this.generateSessionId()
            sessionStorage.setItem('chatSessionId', this.sessionId)
        }
        console.log('🔑 Chat session ID:', this.sessionId)

        // Keyboard shortcut: Ctrl/Cmd + K
        document.addEventListener('keydown', this.handleKeydown)
    },
    beforeDestroy () {
        document.removeEventListener('keydown', this.handleKeydown)
    },
    methods: {
        generateSessionId () {
            // Simple UUID v4 generator
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0
                const v = c === 'x' ? r : (r & 0x3 | 0x8)
                return v.toString(16)
            })
        },
        handleKeydown (e) {
            // Ctrl+K or Cmd+K to toggle
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                this.toggleChat()
            }
            // Esc to close
            if (e.key === 'Escape' && this.isOpen) {
                this.toggleChat()
            }
        },
        toggleChat () {
            this.isOpen = !this.isOpen
            if (this.isOpen && this.messages.length === 0) {
                // Welcome message
                this.messages.push({
                    role: 'assistant',
                    content: "Hi! I'm your flight log analyst. " +
                    'Upload a log file and ask me anything about your flight data!'
                })
            }
            this.$nextTick(() => {
                if (this.isOpen) {
                    const container = this.$refs.messagesContainer
                    container?.scrollTo(0, container.scrollHeight)
                }
            })
        },
        async sendMessage () {
            if (!this.currentMessage.trim() || this.isLoading) return

            const userMessage = this.currentMessage.trim()
            this.currentMessage = ''

            // Add user message
            this.messages.push({
                role: 'user',
                content: userMessage
            })

            // Scroll to bottom
            this.$nextTick(() => {
                const container = this.$refs.messagesContainer
                container.scrollTo(0, container.scrollHeight)
            })

            // Call API with streaming (include session_id)
            this.isLoading = true
            let assistantMsgIndex = null
            try {
                const response = await fetch(
                    'http://localhost:8000/ask?question=' + encodeURIComponent(userMessage) +
                    '&session_id=' + encodeURIComponent(this.sessionId),
                    { method: 'POST' }
                )

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n\n')
                    buffer = lines.pop() // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const event = JSON.parse(line.slice(6))

                            if (event.type === 'token') {
                                // Create message on first token
                                if (assistantMsgIndex === null) {
                                    assistantMsgIndex = this.messages.length
                                    this.messages.push({
                                        role: 'assistant',
                                        content: ''
                                    })
                                    // Hide loading indicator once first token arrives
                                    this.isLoading = false
                                }
                                // Append token to message
                                this.messages[assistantMsgIndex].content += event.content

                                // Auto-scroll as tokens arrive
                                this.$nextTick(() => {
                                    const container = this.$refs.messagesContainer
                                    container.scrollTo(0, container.scrollHeight)
                                })
                            } else if (event.type === 'error') {
                                this.messages[assistantMsgIndex].content = '❌ Error: ' + event.message
                            }
                            // event.type === 'done' means stream finished
                        }
                    }
                }
            } catch (error) {
                this.messages[assistantMsgIndex].content = '❌ Error: Could not connect to the backend. ' +
                    'Make sure the server is running on port 8000.'
                console.error('Streaming error:', error)
            } finally {
                this.isLoading = false
                this.$nextTick(() => {
                    const container = this.$refs.messagesContainer
                    container.scrollTo(0, container.scrollHeight)
                })
            }
        },
        formatMessage (content) {
            // Use marked to parse markdown to HTML
            return marked(content, {
                breaks: true, // Convert \n to <br>
                gfm: true // GitHub Flavored Markdown
            })
        }
    }
}
</script>

<style scoped>
/* Toggle Button */
.chat-toggle-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 1000;
  color: white;
}

.chat-toggle-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* Chat Panel */
.chat-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 450px;
  background: #1e2a38;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  z-index: 1001;
}

/* Header */
.chat-header {
  background: #2c3e50;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #34495e;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ecf0f1;
  font-weight: 600;
  font-size: 16px;
}

.chat-title svg {
  color: #667eea;
}

.chat-close-btn {
  background: none;
  border: none;
  color: #95a5a6;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.chat-close-btn:hover {
  color: #ecf0f1;
}

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-message {
  display: flex;
  animation: slideIn 0.3s ease;
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.chat-message.user .message-bubble {
  background: #5b6fb8;
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-message.assistant .message-bubble {
  background: #2c3e50;
  color: #ecf0f1;
  border-bottom-left-radius: 4px;
  border: 1px solid #34495e;
}

.message-content {
  word-wrap: break-word;
}

/* Markdown styling */
.message-content h1,
.message-content h2,
.message-content h3,
.message-content h4 {
  margin: 16px 0 8px 0;
  font-weight: 600;
  line-height: 1.3;
}

.message-content h1 {
  font-size: 1.5em;
  border-bottom: 2px solid #34495e;
  padding-bottom: 4px;
}

.message-content h2 {
  font-size: 1.3em;
  border-bottom: 1px solid #34495e;
  padding-bottom: 4px;
}

.message-content h3 {
  font-size: 1.15em;
}

.message-content h4 {
  font-size: 1em;
}

.message-content ul,
.message-content ol {
  margin: 8px 0;
  padding-left: 24px;
}

.message-content li {
  margin: 4px 0;
}

.message-content p {
  margin: 8px 0;
}

.message-content code {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-content pre {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-content pre code {
  background: none;
  padding: 0;
}

.message-content blockquote {
  border-left: 3px solid #667eea;
  padding-left: 12px;
  margin: 8px 0;
  color: #bdc3c7;
}

.message-content a {
  color: #667eea;
  text-decoration: underline;
}

.message-content a:hover {
  color: #764ba2;
}

.message-content strong {
  font-weight: 700;
}

.message-content em {
  font-style: italic;
}

.message-content hr {
  border: none;
  border-top: 1px solid #34495e;
  margin: 16px 0;
}

/* Loading indicator */
.message-bubble.loading {
  padding: 16px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #95a5a6;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

/* Input */
.chat-input-container {
  padding: 16px 20px;
  background: #2c3e50;
  border-top: 1px solid #34495e;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  background: #1e2a38;
  border: 1px solid #34495e;
  border-radius: 8px;
  padding: 10px 12px;
  color: #ecf0f1;
  font-size: 14px;
  resize: none;
  max-height: 120px;
  font-family: inherit;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
}

.chat-input::placeholder {
  color: #7f8c8d;
}

.send-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Animations */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter, .slide-leave-to {
  transform: translateX(100%);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #1e2a38;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #34495e;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #4a5f7f;
}
</style>
