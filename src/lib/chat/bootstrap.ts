import type { Message } from "ai";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import ChatConversation from "@/models/ChatConversation";
import type { ChatListItem } from "@/types/chat-list";

export type { ChatListItem } from "@/types/chat-list";

export type ChatPageBootstrap = {
  conversations: ChatListItem[];
  activeId: string;
  activeMessages: Message[];
};

export type ChatBootstrapOptions = {
  /**
   * When true (e.g. user opened Chat from the nav with `?new=1`), create a new
   * empty thread and focus it instead of resuming the latest conversation.
   */
  startFresh?: boolean;
};

/**
 * Load or create the user's chat list and the active conversation + messages.
 * By default the latest thread is selected; with `startFresh`, a new empty
 * thread is created and selected (nav “Chat” entry).
 */
export async function getChatPageBootstrap(
  appUserId: string,
  options?: ChatBootstrapOptions
): Promise<ChatPageBootstrap> {
  await connectToDatabase();
  const userOid = new Types.ObjectId(appUserId);

  const list = await ChatConversation.aggregate<{
    _id: Types.ObjectId;
    title: string;
    updatedAt: Date;
    messageCount: number;
  }>([
    { $match: { user: userOid } },
    { $sort: { updatedAt: -1 } },
    { $limit: 100 },
    {
      $project: {
        _id: 1,
        title: 1,
        updatedAt: 1,
        messageCount: { $size: { $ifNull: ["$messages", []] } },
      },
    },
  ]);

  if (list.length === 0) {
    const created = await ChatConversation.create({
      user: userOid,
      title: "New chat",
      messages: [],
    });
    return {
      conversations: [
        {
          id: created._id.toString(),
          title: created.title,
          updatedAt: created.updatedAt.toISOString(),
          messageCount: 0,
        },
      ],
      activeId: created._id.toString(),
      activeMessages: [],
    };
  }

  const mappedList: ChatListItem[] = list.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c.messageCount,
  }));

  if (options?.startFresh) {
    const created = await ChatConversation.create({
      user: userOid,
      title: "New chat",
      messages: [],
    });
    const fresh: ChatListItem = {
      id: created._id.toString(),
      title: created.title,
      updatedAt: created.updatedAt.toISOString(),
      messageCount: 0,
    };
    return {
      conversations: [fresh, ...mappedList],
      activeId: fresh.id,
      activeMessages: [],
    };
  }

  const activeId = list[0]._id.toString();
  const full = await ChatConversation.findById(activeId)
    .select("messages")
    .lean();

  const raw = full?.messages;
  const activeMessages = Array.isArray(raw) ? (raw as Message[]) : [];

  return {
    conversations: mappedList,
    activeId,
    activeMessages,
  };
}
