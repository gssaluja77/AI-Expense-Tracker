import { requireUser } from "@/lib/auth/session";
import { getChatPageBootstrap } from "@/lib/chat/bootstrap";
import { ChatView } from "@/components/chat/ChatView";

export const metadata = { title: "Chat" };

function readStartFresh(
  searchParams: Record<string, string | string[] | undefined>
): boolean {
  const raw = searchParams.new;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "1" || v === "true";
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const boot = await getChatPageBootstrap(user.appUserId, {
    startFresh: readStartFresh(sp),
  });

  return (
    <ChatView
      userName={user.name}
      baseCurrency={user.baseCurrency}
      initialConversations={boot.conversations}
      initialConversationId={boot.activeId}
      initialMessages={boot.activeMessages}
    />
  );
}
