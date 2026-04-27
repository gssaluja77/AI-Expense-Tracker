import { requireUser } from "@/lib/auth/session";
import { ChatView } from "@/components/chat/ChatView";

export const metadata = { title: "Chat" };

export default async function ChatPage() {
  const user = await requireUser();

  return (
    <ChatView userName={user.name} baseCurrency={user.baseCurrency} />
  );
}
