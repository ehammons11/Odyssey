import {
  createContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConversation } from "@elevenlabs/react";
import { environmentStore } from "../stores/environmentStore";

interface ConversationContextType {
  conversation: ReturnType<typeof useConversation>;
  startSession: () => void;
  endSession: () => void;
  agentMediaStream: MediaStream | null;
  isConnected: boolean;
  isSpeaking: boolean;
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
  const [agentMediaStream, setAgentMediaStream] = useState<MediaStream | null>(
    null,
  );
  const observerRef = useRef<MutationObserver | null>(null);

  const disconnectObserver = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  /** Scan a single node — if it's the SDK's hidden <audio>, capture its stream. */
  const tryCaptureAudioElement = useCallback(
    (node: Node): boolean => {
      if (
        node instanceof HTMLAudioElement &&
        node.srcObject instanceof MediaStream
      ) {
        // Silence the SDK's default playback while keeping the stream active.
        // Using volume=0 (NOT muted) so the browser keeps decoding the stream.
        node.volume = 0;
        setAgentMediaStream(node.srcObject);
        disconnectObserver();
        return true;
      }
      return false;
    },
    [disconnectObserver],
  );

  /** Start observing document.body for the SDK's hidden <audio> element. */
  const startObserver = useCallback(() => {
    disconnectObserver();

    // Check elements that already exist (in case the element was added before
    // we started observing — e.g. during connection retry).
    for (const child of document.body.children) {
      if (tryCaptureAudioElement(child)) return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (tryCaptureAudioElement(node)) return;
        }
      }
    });

    observer.observe(document.body, { childList: true });
    observerRef.current = observer;
  }, [disconnectObserver, tryCaptureAudioElement]);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to conversation");
    },
    onDisconnect: () => {
      console.log("Disconnected from conversation");
      disconnectObserver();
      setAgentMediaStream(null);
    },
    onError: (error: string) => {
      console.error("Conversation error:", error);
      disconnectObserver();
      setAgentMediaStream(null);
    },
  });

  const startSession = () => {
    // Start watching for the SDK's hidden <audio> element BEFORE initiating the
    // connection so we catch elements appended during LiveKit room setup.
    startObserver();

    conversation.startSession({
      agentId: "agent_0201kgxqgkenf5y9w02sxxsefknk",
      connectionType: "webrtc",
      clientTools: {
        changeEnvironment: async () => {
          console.log("Received request to change environment");
          environmentStore.next();
        },
      },
    });
  };

  const endSession = () => {
    disconnectObserver();
    setAgentMediaStream(null);
    conversation.endSession();
  };

  // Determine if we're connected based on the conversation status.
  const isConnected = conversation.status === "connected";

  const value: ConversationContextType = {
    conversation,
    startSession,
    endSession,
    agentMediaStream,
    isConnected,
    isSpeaking: conversation.isSpeaking,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
