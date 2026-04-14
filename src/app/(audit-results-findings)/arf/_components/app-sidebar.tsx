"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
    ShieldAlert,     // Remittance Audit
    Banknote,        // Treasury Audits Group
    Map,             // Field Verification Group
    MapPin,          // Geo-Tagging Audits
    Truck,           // Route Compliance
    Tag,             // Pricing Violations
    Settings,        // Settings Group
    BookOpen,        // Findings Dictionary
    UsersRound,      // Auditor Assignments
    Package,         // Inventory Group
    Boxes,           // Warehouse Stock
    Wallet,          // Collections Group
    HandCoins,       // Disbursements Group
    ReceiptText,     // Expenses
    FileSearch,      // Others / Miscellaneous
    Radar,           // Tracing Group
    ScanSearch,      // Product Trace
    Waypoints        // Cross Trace
} from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
    navMain: [
        {
            title: "Collection Audits",
            url: "#",
            icon: Wallet,
            isActive: true,
            items: [
                {
                    title: "Remittance Ledger",
                    url: "/arf/remittance-audit",
                    icon: ShieldAlert,
                },
                {
                    title: "Pricing & Credit",
                    url: "/arf/pricing-violations",
                    icon: Tag,
                },
            ],
        },
        {
            title: "Disbursement Audits",
            url: "#",
            icon: HandCoins,
            isActive: false,
            items: [
                {
                    title: "Petty Cash & Expenses",
                    url: "/arf/petty-cash-audit",
                    icon: ReceiptText,
                },
                {
                    title: "Supplier Payments",
                    url: "/arf/supplier-audit",
                    icon: Banknote,
                },
            ],
        },
        {
            title: "Inventory Audits",
            url: "#",
            icon: Package,
            isActive: false,
            items: [
                {
                    title: "Warehouse Discrepancies",
                    url: "/arf/warehouse-audit",
                    icon: Boxes,
                },
                {
                    title: "Truck / Rolling Stock",
                    url: "/arf/truck-inventory-audit",
                    icon: Truck,
                },
            ],
        },
        {
            title: "Field Verification",
            url: "#",
            icon: Map,
            isActive: false,
            items: [
                {
                    title: "Geo-Tagging & Store",
                    url: "/arf/field-verification",
                    icon: MapPin,
                },
                {
                    title: "Route Compliance",
                    url: "/arf/route-compliance",
                    icon: Map,
                },
            ],
        },
        {
            // 🚀 NEW: Forensic Tracing Module
            title: "Forensic Tracing",
            url: "#",
            icon: Radar,
            isActive: false,
            items: [
                {
                    title: "Product Trace",
                    url: "/arf/tracing/product-trace",
                    icon: ScanSearch,
                },
                {
                    title: "Cross Trace",
                    url: "/arf/tracing/cross-trace",
                    icon: Waypoints,
                },
            ],
        },
        {
            title: "Other Findings",
            url: "#",
            icon: FileSearch,
            isActive: false,
            items: [
                {
                    title: "General Incidents",
                    url: "/arf/general-incidents",
                    icon: ShieldAlert,
                },
            ],
        },
        {
            title: "Audit Settings",
            url: "#",
            icon: Settings,
            isActive: false,
            items: [
                {
                    title: "Findings Dictionary",
                    url: "/arf/settings/findings-dictionary",
                    icon: BookOpen,
                },
                {
                    title: "Auditor Access",
                    url: "/arf/settings/auditor-access",
                    icon: UsersRound,
                },
            ],
        },
    ],
};

export function AppSidebar({
                               className,
                               ...props
                           }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar
            {...props}
            className={cn(
                "border-r border-sidebar-border/60 dark:border-white/20",
                "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_40px_-24px_rgba(0,0,0,0.9)]",
                className
            )}
        >
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/main-dashboard">
                                <div className="flex aspect-square size-10 items-center justify-center overflow-hidden">
                                    <Image
                                        src="/vertex_logo_black.png"
                                        alt="VOS Logo"
                                        width={40}
                                        height={40}
                                        className="h-9 w-10 object-contain"
                                        priority
                                    />
                                </div>

                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">VOS Web</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                         Audit Results Findings
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <Separator />

            <SidebarContent>
                <div className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
                    Platform
                </div>

                <ScrollArea
                    className={cn(
                        "min-h-0 flex-1",
                        "[&_[data-radix-scroll-area-viewport]>div]:block",
                        "[&_[data-radix-scroll-area-viewport]>div]:w-full",
                        "[&_[data-radix-scroll-area-viewport]>div]:min-w-0"
                    )}
                >
                    <div className="w-full min-w-0">
                        <NavMain items={data.navMain} />
                    </div>
                </ScrollArea>
            </SidebarContent>

            <SidebarFooter className="p-0">
                <Separator />
                <div className="py-3 text-center text-xs text-muted-foreground">
                    VOS Web v2.0
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}