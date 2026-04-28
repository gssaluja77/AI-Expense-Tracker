import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import ChatConversation from "@/models/ChatConversation";

export const dynamic = "force-dynamic";

/**
 * `GET` — list this user's chat threads (id, title, updatedAt) — no messages.
 * `POST` — create an empty new thread.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const userOid = new Types.ObjectId(user.appUserId);

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

  return NextResponse.json({
    conversations: list.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c.messageCount,
    })),
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const userOid = new Types.ObjectId(user.appUserId);

  const created = await ChatConversation.create({
    user: userOid,
    title: "New chat",
    messages: [],
  });

  return NextResponse.json({
    id: created._id.toString(),
    title: created.title,
    updatedAt: created.updatedAt.toISOString(),
    messageCount: 0,
  });
}
