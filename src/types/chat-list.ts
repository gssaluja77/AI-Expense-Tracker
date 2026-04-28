/**
 * A row in the chat history sidebar.
 */
export type ChatListItem = {
  id: string;
  title: string;
  updatedAt: string;
  /** Number of saved messages in this thread (0 = empty / “new”). */
  messageCount: number;
};
