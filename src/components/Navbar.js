"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Wrench,
  Menu,
  X,
  LayoutDashboard,
  FilePlus2,
  ClipboardList,
  Boxes,
  CalendarCheck,
  Users,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS = {
  student: "Student/Staff",
  technician: "Technician",
  admin: "Admin",
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Find out who is logged in, and keep it updated when they log in or out
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadUser(user) {
      if (!user) {
        if (active) {
          setSignedIn(false);
          setProfile(null);
          setReady(true);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (active) {
        setSignedIn(true);
        setProfile(data ?? null);
        setReady(true);
      }
    }

    supabase.auth.getUser().then(({ data }) => loadUser(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // setTimeout avoids a known Supabase issue with calling the
        // database from inside this callback
        setTimeout(() => loadUser(session?.user ?? null), 0);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Close the phone menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/login");
  }

  const role = profile?.role;
  const complaintsLabel =
    role === "admin"
      ? "All complaints"
      : role === "technician"
      ? "Assigned complaints"
      : "My complaints";

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/report", label: "Report an issue", icon: FilePlus2 },
    { href: "/complaints", label: complaintsLabel, icon: ClipboardList },
    { href: "/equipment", label: "Equipment", icon: Boxes },
  ];

  // Admins and technicians see the maintenance schedule
  if (role === "admin" || role === "technician") {
    links.push({
      href: "/maintenance",
      label: "Maintenance",
      icon: CalendarCheck,
    });
  }

  // Only admins see the Users page
  if (role === "admin") {
    links.push({ href: "/users", label: "Users", icon: Users });
  }

  function isActive(href) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function desktopLinkClass(href) {
    return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-blue-50 text-blue-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;
  }

  function mobileLinkClass(href) {
    return `flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium ${
      isActive(href)
        ? "bg-blue-50 text-blue-700"
        : "text-slate-700 hover:bg-slate-100"
    }`;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Wrench size={18} />
          </span>
          <span className="font-bold text-slate-900">
            Smart Campus
            <span className="hidden text-blue-600 sm:inline"> Maintenance</span>
          </span>
        </Link>

        {/* Desktop links */}
        {ready && signedIn && (
          <nav className="hidden items-center gap-1 xl:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={desktopLinkClass(link.href)}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Desktop right side */}
        <div className="hidden items-center gap-3 xl:flex">
          {ready && signedIn && (
            <>
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-slate-900">
                  {profile?.full_name ?? "Account"}
                </p>
                <p className="text-xs text-slate-500">
                  {ROLE_LABELS[role] ?? ""}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <LogOut size={16} />
                Log out
              </button>
            </>
          )}
          {ready && !signedIn && (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Phone menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 xl:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Phone menu panel */}
      {menuOpen && ready && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 xl:hidden">
          {signedIn ? (
            <>
              <div className="mb-2 border-b border-slate-100 px-3 pb-3">
                <p className="font-medium text-slate-900">
                  {profile?.full_name ?? "Account"}
                </p>
                <p className="text-sm text-slate-500">
                  {ROLE_LABELS[role] ?? ""}
                </p>
              </div>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={mobileLinkClass(link.href)}
                >
                  <link.icon size={20} />
                  {link.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={20} />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={mobileLinkClass("/login")}>
                <LogIn size={20} />
                Log in
              </Link>
              <Link href="/signup" className={mobileLinkClass("/signup")}>
                <UserPlus size={20} />
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}