import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Newspaper, Image as ImageIcon, Star, Home, LogOut, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TOKEN_KEY } from '@/lib/adminApi';

const ITEMS: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] = [
  { to: '/admin', label: 'Брони', icon: LayoutDashboard, end: true },
  { to: '/admin/cottages', label: 'Домики', icon: Home },
  { to: '/admin/site-elements', label: 'Карта', icon: Map },
  { to: '/admin/seo-pages', label: 'SEO', icon: FileText },
  { to: '/admin/blog-posts', label: 'Блог', icon: Newspaper },
  { to: '/admin/images', label: 'Картинки', icon: ImageIcon },
  { to: '/admin/reviews', label: 'Отзывы', icon: Star },
];

/**
 * Общая верхняя навигация для всех страниц админки. Подсвечивает активный раздел,
 * показывает кнопку выхода. Используется вместо самописных header-блоков в подстраницах.
 */
export function AdminNav({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/admin/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800 bg-[#141414]/95 backdrop-blur supports-[backdrop-filter]:bg-[#141414]/70">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
        <Link to="/admin" className="flex items-center gap-2 mr-2 shrink-0">
          <span className="font-semibold tracking-tight">Звуки Леса</span>
          <span className="hidden sm:inline text-xs text-neutral-500">админка</span>
        </Link>
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm whitespace-nowrap transition-colors',
                  'text-neutral-400 hover:text-white hover:bg-neutral-900',
                  isActive && 'text-white bg-neutral-900',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {children}
          <Button variant="ghost" size="sm" onClick={logout} className="text-neutral-400 hover:text-white">
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </div>
    </header>
  );
}