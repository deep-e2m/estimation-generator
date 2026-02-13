import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FileText,
  FolderOpen,
  Home,
  Menu,
  Plus,
  Settings,
  X,
  User,
  LogOut,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
];

/**
 * Alternative application layout with responsive navigation
 * Note: DashboardLayout is the primary layout used in the app
 */
export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar lg:block hidden">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">
                <FileText style={{ width: 20, height: 20 }} />
              </div>
              <span className="sidebar-logo-text">Estimate AI</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn('nav-item', isActive(item.href) && 'nav-item-active')}
              >
                <item.icon style={{ width: 20, height: 20 }} />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Create Quote Button */}
          <div className="sidebar-footer">
            <Link to="/quotes/new" className="nav-button-primary">
              <Plus style={{ width: 16, height: 16 }} />
              New Quote
            </Link>
          </div>

          {/* User Section */}
          <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-gray-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className="avatar avatar-md">JD</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="truncate text-sm font-medium text-gray-900">John Doe</p>
                <p className="truncate text-xs text-gray-500">john@example.com</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="header lg:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="header-icon-btn"
          aria-label="Open menu"
        >
          <Menu style={{ width: 24, height: 24 }} />
        </button>

        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <FileText style={{ width: 20, height: 20 }} />
          </div>
          <span className="sidebar-logo-text">Estimate AI</span>
        </div>

        <div className="user-menu">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="avatar avatar-sm"
          >
            JD
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="dropdown-content" style={{ right: 0 }}>
                <Link
                  to="/settings"
                  className="dropdown-item"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings style={{ width: 16, height: 16 }} />
                  Settings
                </Link>
                <Link
                  to="/profile"
                  className="dropdown-item"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User style={{ width: 16, height: 16 }} />
                  Profile
                </Link>
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item dropdown-item-danger"
                  style={{ width: '100%' }}
                  onClick={() => setUserMenuOpen(false)}
                >
                  <LogOut style={{ width: 16, height: 16 }} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="sidebar-backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="sidebar sidebar-open">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="sidebar-header">
                <div className="sidebar-logo">
                  <div className="sidebar-logo-icon">
                    <FileText style={{ width: 20, height: 20 }} />
                  </div>
                  <span className="sidebar-logo-text">Estimate AI</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="sidebar-toggle"
                  aria-label="Close menu"
                >
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              <nav className="sidebar-nav">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn('nav-item', isActive(item.href) && 'nav-item-active')}
                  >
                    <item.icon style={{ width: 20, height: 20 }} />
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="sidebar-footer">
                <Link
                  to="/quotes/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="nav-button-primary"
                >
                  <Plus style={{ width: 16, height: 16 }} />
                  New Quote
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="main-wrapper" style={{ paddingTop: '64px' }}>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
