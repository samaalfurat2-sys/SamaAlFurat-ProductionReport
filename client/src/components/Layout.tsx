import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { FeedbackDialog } from "./FeedbackButton";
import { Home, PlusCircle, ClipboardList, Settings, BarChart2, Droplets } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  
  const isRTL = i18n.language === 'ar';
  const userRole = localStorage.getItem('userRole') || 'operator';
  const isAccountant = userRole === 'accountant';
  const isAuditor = userRole === 'auditor';
  const isManager = userRole === 'manager';

  const navItems = [
    { href: "/", icon: Home, label: t('home') },
    ...((isAccountant || isAuditor) && !isManager ? [] : [{ href: "/entry", icon: PlusCircle, label: t('new_entry') }]),
    { href: "/records", icon: ClipboardList, label: t('view_records') },
    { href: "/settings", icon: Settings, label: t('settings') },
  ];

  return (
    <div className={`min-h-screen flex flex-col bg-background text-foreground ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-primary text-primary-foreground shadow-sm">
        <div className="flex h-16 items-center px-4 font-bold text-lg gap-3">
          <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex flex-shrink-0 items-center justify-center p-0.5">
            <img src={isRTL ? "/logo.png" : "/logo-en.jpg"} alt="Sama Alfurat Logo" className="w-full h-full object-contain rounded-md" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider opacity-90 leading-tight">
              {t('company_name', 'Sama Alfurat Industries And Trade Co Ltd')}
            </span>
            <span className="leading-tight text-sm">
              {t('app_title')}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16">
        <div className="container mx-auto p-4 max-w-2xl">
          {children}
        </div>
      </main>

      <FeedbackDialog />
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full border-t bg-background pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                }`}>
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}