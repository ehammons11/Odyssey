import { useContext } from "react";
import { ConversationContext } from "../contexts/ConversationContext";

/**
 * Custom hook to access the elevenlabs conversation context.
 */
export function useConversationContext() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error(
      "useConversationContext must be used within a ConversationProvider",
    );
  }
  return context;
}
