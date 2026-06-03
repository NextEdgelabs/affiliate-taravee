"use client";

import { Button } from "@taravee/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@taravee/ui/components/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

import { SidebarNav } from "./app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
