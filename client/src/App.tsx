import { Conversation, ConversationContent, ConversationEmptyState } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { PromptInput, PromptInputTextarea, PromptInputSubmit, PromptInputFooter } from '@/components/ai-elements/prompt-input';
import { useChatStream } from '@/hooks/useChatStream';

export default function ChatBot() {
  const { messages, isStreaming, sendMessage } = useChatStream();

  const handleSubmit = async (message: { text: string }, event: React.FormEvent) => {
    event.preventDefault();
    await sendMessage(message.text);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b bg-card px-6 py-4">
        <h1 className="text-2xl font-semibold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">Ask me anything or search the web</p>
      </header>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Type a message to begin chatting"
            />
          ) : (
            messages.map((msg) => (
              <Message key={msg.id} from={msg.role}>
                <MessageContent>
                  {msg.toolCalls?.map((toolCall) => (
                    <Tool key={toolCall.id} defaultOpen>
                      <ToolHeader
                        title={toolCall.name}
                        type={`tool-${toolCall.name}`}
                        state={toolCall.state}
                      />
                      <ToolContent>
                        <ToolInput input={toolCall.input} />
                        <ToolOutput output={toolCall.output} errorText={undefined} />
                      </ToolContent>
                    </Tool>
                  ))}
                  {msg.content && <MessageResponse>{msg.content}</MessageResponse>}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>

      <div className="border-t bg-card p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputFooter>
            <PromptInputTextarea placeholder="Type your message..." />
            <PromptInputSubmit status={isStreaming ? 'streaming' : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
