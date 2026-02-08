import { createContext, type ReactNode } from "react";
import { useConversation } from "@elevenlabs/react";

interface ConversationContextType {
  conversation: ReturnType<typeof useConversation>;
  startSession: () => void;
  endSession: () => void;
  isConnected: boolean;
}

const ConversationContext = createContext<ConversationContextType | undefined>(
  undefined,
);

export { ConversationContext };

interface ConversationProviderProps {
  children: ReactNode;
}

/**
 * Provider component for managing conversation state and actions.
 */
export function ConversationProvider({ children }: ConversationProviderProps) {
  const conversation = useConversation({
    onConnect: () => console.log("Connected to conversation"),
    onDisconnect: () => console.log("Disconnected from conversation"),
    onError: (error: string) => console.error("Conversation error:", error),
  });

  const startSession = () => {
    conversation.startSession({
      agentId: "agent_01jxkjstcmf0pttkh1zq3t1jwc",
      connectionType: "webrtc",
    });
  };

  const endSession = () => {
    conversation.endSession();
  };

  // Determine if we're connected based on the conversation status
  const isConnected = conversation.status === "connected";

  const value: ConversationContextType = {
    conversation,
    startSession,
    endSession,
    isConnected,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
