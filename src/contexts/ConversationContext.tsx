import { createContext, useCallback, useRef, type ReactNode } from "react";
import { useConversation } from "@elevenlabs/react";
import { environmentStore } from "../stores/environmentStore";

type OnAudioCallback = (audio: string) => void;

interface ConversationContextType {
  conversation: ReturnType<typeof useConversation>;
  startSession: () => void;
  endSession: () => void;
  setOnAudio: (callback: OnAudioCallback | null) => void;
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
  const onAudioRef = useRef<OnAudioCallback | null>(null);

  const setOnAudio = useCallback((callback: OnAudioCallback | null) => {
    onAudioRef.current = callback;
  }, []);

  const conversation = useConversation({
    onConnect: () => console.log("Connected to conversation"),
    onDisconnect: () => console.log("Disconnected from conversation"),
    onError: (error: string) => console.error("Conversation error:", error),
    onAudio: (audio) => onAudioRef.current?.(audio),
    volume: 0.0,
  });

  const startSession = () => {
    conversation.startSession({
      agentId: "agent_0201kgxqgkenf5y9w02sxxsefknk",
      connectionType: "websocket",
      clientTools: {
        changeEnvironment: async () => {
          console.log("Received request to change environment");
          environmentStore.next();
        },
      },
    });
  };

  const endSession = () => {
    conversation.endSession();
  };

  // Determine if we're connected based on the conversation status.
  const isConnected = conversation.status === "connected";

  const value: ConversationContextType = {
    conversation,
    startSession,
    endSession,
    setOnAudio,
    isConnected,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
