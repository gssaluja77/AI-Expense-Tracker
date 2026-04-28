import { NextResponse, type NextRequest } from "next/server";
import type { Message } from "ai";
import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import ChatConversation from "@/models/ChatConversation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * `GET` — one conversation with full `messages` (AI SDK `Message` shape).
 * `PATCH` — save `messages` and optionally `title` (or auto-titles from 1st user line).
 * `DELETE` — remove a thread the user owns.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectToDatabase();
  const userOid = new Types.ObjectId(user.appUserId);

  const doc = await ChatConversation.findOne({
    _id: new Types.ObjectId(id),
    user: userOid,
  })
    .lean();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const msgs = Array.isArray(doc.messages) ? doc.messages : [];

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
    messageCount: msgs.length,
    messages: msgs,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    messages?: Message[];
    title?: string;
  };

  await connectToDatabase();
  const userOid = new Types.ObjectId(user.appUserId);
  const filter = { _id: new Types.ObjectId(id), user: userOid };

  const existing = await ChatConversation.findOne(filter);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (Array.isArray(body.messages)) {
    existing.set("messages", body.messages);
    if (body.messages.length === 0) {
      existing.title = "New chat";
    }
  }
  if (typeof body.title === "string" && body.title.trim()) {
    existing.title = body.title.trim().slice(0, 200);
  } else if (
    Array.isArray(body.messages) &&
    body.messages.length > 0 &&
    (existing.title === "New chat" || !existing.title)
  ) {
    const t = firstUserMessagePreview(body.messages);
    if (t) {
      existing.title = t;
    }
  }
  await existing.save();

  const mc = Array.isArray(existing.messages) ? existing.messages.length : 0;

  return NextResponse.json({
    id: existing._id.toString(),
    title: existing.title,
    updatedAt: existing.updatedAt.toISOString(),
    messageCount: mc,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectToDatabase();
  const userOid = new Types.ObjectId(user.appUserId);
  const oid = new Types.ObjectId(id);

  const doc = await ChatConversation.findOne({
    _id: oid,
    user: userOid,
  })
    .select("messages")
    .lean();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mc = Array.isArray(doc.messages) ? doc.messages.length : 0;
  if (mc === 0) {
    return NextResponse.json(
      { error: "Cannot delete an empty chat." },
      { status: 400 }
    );
  }

  const res = await ChatConversation.deleteOne({ _id: oid, user: userOid });

  if (res.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

function firstUserMessagePreview(messages: Message[]): string | undefined {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = getUserText(m);
    if (!text) continue;
    const t = text.trim().replace(/\s+/g, " ");
    if (!t) continue;
    return t.length > 60 ? `${t.slice(0, 57)}…` : t;
  }
  return undefined;
}

function getUserText(m: Message): string {
  const x = m as { content?: unknown; parts?: Array<{ type?: string; text?: string }> };
  if (typeof x.content === "string" && x.content) return x.content;
  if (x.parts) {
    return x.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ");
  }
  return "";
}
