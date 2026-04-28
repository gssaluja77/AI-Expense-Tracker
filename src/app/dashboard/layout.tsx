import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileTopBar } from "@/components/layout/MobileTopBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} />
      {/* Mobile: lock column to viewport so header + bottom nav stay put while only <main> scrolls. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col max-md:h-dvh max-md:max-h-dvh md:min-h-dvh">
        <MobileTopBar user={user} />
        <main
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-24 md:overflow-visible md:px-8 md:pb-10 md:pt-8 max-md:pt-[calc(1rem+max(0.75rem,env(safe-area-inset-top,0px))+3.75rem+1px)]"
        >
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
