import Link from "next/link";
import { logout } from "@/app/actions";
import { getDict } from "@/lib/locale";
import { getUser } from "@/lib/session";
import LangSwitch from "./LangSwitch";
import Logo from "./Logo";

export default async function Header() {
  const [user, d] = await Promise.all([getUser(), getDict()]);
  const link = "rounded-md px-3 py-1.5 text-sm text-dim hover:bg-sunk hover:text-ink";
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-6">
          <Link href={user ? "/app" : "/"} aria-label="DocuMind"><Logo /></Link>
          {user && (
            <nav className="hidden items-center gap-1 sm:flex">
              <Link href="/app" className={link}>{d.nav.documents}</Link>
              <Link href="/app/presentations" className={link}>{d.nav.presentations}</Link>
              <Link href="/app/summaries" className={link}>{d.nav.summaries}</Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LangSwitch />
          {user ? (
            <form action={logout} className="flex items-center gap-3">
              <span className="hidden text-sm text-dim sm:inline">{user.name}</span>
              <button className="rounded-md border border-line bg-card px-3 py-1.5 text-sm hover:bg-sunk">{d.nav.logout}</button>
            </form>
          ) : (
            <>
              <Link href="/login" className={link}>{d.nav.login}</Link>
              <Link href="/register" className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85">{d.nav.start}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
