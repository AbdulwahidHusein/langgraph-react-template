import { useState, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
  output?: any;
  state: 'input-available' | 'output-available' | 'output-error';
}

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const threadId = useRef(`thread-${Date.now()}`);
  const currentContentRef = useRef('');

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Add user message
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    currentContentRef.current = '';

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId.current, message: text }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMsgId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'token') {
              currentContentRef.current += data.content;
              setMessages(prev => {
                const newMessages = [...prev];
                if (assistantMsgId) {
                  const idx = newMessages.findIndex(m => m.id === assistantMsgId);
                  if (idx >= 0) {
                    newMessages[idx].content = currentContentRef.current;
                  }
                } else {
                  assistantMsgId = `msg-${Date.now()}`;
                  newMessages.push({
                    id: assistantMsgId,
                    role: 'assistant',
                    content: currentContentRef.current,
                  });
                }
                return newMessages;
              });
            }

            if (data.type === 'tool_start') {
              // Ensure assistant message exists
              if (!assistantMsgId) {
                assistantMsgId = `msg-${Date.now()}`;
                setMessages(prev => [...prev, {
                  id: assistantMsgId!,
                  role: 'assistant',
                  content: '',
                }]);
              }
              
              // Add tool call to assistant message
              const toolId = `tool-${Date.now()}`;
              setMessages(prev => {
                const newMessages = [...prev];
                const msg = newMessages.find(m => m.id === assistantMsgId);
                if (msg && msg.role === 'assistant') {
                  if (!msg.toolCalls) {
                    msg.toolCalls = [];
                  }
                  msg.toolCalls.push({
                    id: toolId,
                    name: data.tool,
                    input: data.input || {},
                    state: 'input-available',
                  });
                }
                return newMessages;
              });
            }

            if (data.type === 'tool_result') {
              setMessages(prev => {
                const newMessages = [...prev];
                for (let i = newMessages.length - 1; i >= 0; i--) {
                  const msg = newMessages[i];
                  if (msg.role === 'assistant' && msg.toolCalls) {
                    const toolCall = msg.toolCalls.find(tc => tc.name === data.tool);
                    if (toolCall) {
                      toolCall.output = data.result;
                      toolCall.state = 'output-available';
                      break;
                    }
                  }
                }
                return newMessages;
              });
            }

            if (data.type === 'status' && data.status === 'done') {
              setIsStreaming(false);
              currentContentRef.current = '';
            }

            if (data.type === 'error') {
              throw new Error(data.message || 'Unknown error');
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (e) {
      console.error('Stream error:', e);
      setIsStreaming(false);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Error: Failed to get response',
      }]);
    }
  };

  return { messages, isStreaming, sendMessage };
}

