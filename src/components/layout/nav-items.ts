import {
  LayoutDashboard,
  ListChecks,
  PieChart,
  MessageSquareText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Use for active-state matching when `href` includes a query string. */
  activePath?: string;
  label: string;
  icon: LucideIcon;
}

/** Primary app navigation. Reused by Sidebar (desktop) + BottomNav (mobile). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ListChecks },
  { href: "/dashboard/budgets", label: "Budgets", icon: PieChart },
  {
    href: "/dashboard/chat?new=1",
    activePath: "/dashboard/chat",
    label: "Chat",
    icon: MessageSquareText,
  },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
