import { Sidebar } from './Sidebar';
import { MobileTopBar } from './MobileTopBar';

/**
 * Layout shell pre staff oblasť (admin + organizer):
 * fixná ľavá sidebar na desktope (lg), hamburger drawer na mobile.
 * Obsah je odsadený o šírku sidebaru (lg:pl-64). Pozadia/dark rieši stránka
 * (každá si nesie vlastný `min-h-screen bg-gray-50 dark:bg-gray-950` wrapper).
 */
export function StaffShell({ children }: { children: React.ReactNode }) {
  return (
    // Krok 32: krémový brand base (zladenie s landingom/public). Stránky si nesú
    // vlastný min-h-screen bg-cream; tu je base pre istotu (a za fixným sidebarom).
    <div className="theme-scope min-h-screen bg-cream dark:bg-gray-950">
      <Sidebar />
      <div className="lg:pl-64">
        <MobileTopBar />
        {children}
      </div>
    </div>
  );
}
