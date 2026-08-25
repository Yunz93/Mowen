import { stripModePrefix, type TimelineMessage } from "@mowen/protocol";

export const OPEN_CONVERSATION_SEARCH_EVENT = "mowen:open-conversation-search";

export function conversationMessageDomId(messageId: string): string {
  return `conversation-msg-${messageId}`;
}

export function searchableText(message: Pick<TimelineMessage, "role" | "text">): string {
  if (message.role === "toolResult" || message.role === "system") return "";
  if (message.role === "user") return stripModePrefix(message.text);
  return message.text;
}

export function matchConversationMessages(
  messages: Array<Pick<TimelineMessage, "id" | "role" | "text">>,
  query: string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return messages
    .filter((message) => searchableText(message).toLowerCase().includes(needle))
    .map((message) => message.id);
}

export function stepSearchIndex(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (index + delta + count) % count;
}
