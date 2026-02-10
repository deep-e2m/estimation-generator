/**
 * Dashboard Layout
 *
 * Main application layout with:
 * - Collapsible sidebar navigation
 * - Header with user menu
 * - Main content area
 * - Clean, professional design
 */

import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  Plus,
} from 'lucide-react'

import { useAuthStore, useUser } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import '@/styles/layout.css'

// Navigation items
const mainNavItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderOpen,
  },
]

const bottomNavItems = [
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    label: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
  },
]

// Sidebar navigation link component
function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  collapsed: boolean
}) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        cn(
          'sidebar-nav-item',
          isActive && 'active',
          collapsed && 'justify-center px-2.5'
        )
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// User dropdown menu
function UserMenu() {
  const [open, setOpen] = useState(false)
  const user = useUser()
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-100 transition-all duration-200"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar
          src={user?.avatar_url}
          alt={user?.full_name || 'User'}
          size="sm"
        />
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
            {user?.full_name || 'User'}
          </p>
          <p className="text-xs text-gray-500 truncate max-w-[150px]">
            {user?.email}
          </p>
        </div>
        <ChevronDown className={cn(
          "hidden md:block h-4 w-4 text-gray-400 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white shadow-xl z-50 animate-fadeIn">
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
              <span className="mt-2 inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                {user?.role}
              </span>
            </div>

            <div className="py-2">
              <NavLink
                to="/settings/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setOpen(false)}
              >
                <Settings className="h-4 w-4 text-gray-500" />
                Account Settings
              </NavLink>
            </div>

            <div className="border-t border-gray-100 py-2">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Get current page title
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path.startsWith('/projects')) return 'Projects'
    if (path.startsWith('/settings')) return 'Settings'
    if (path.startsWith('/help')) return 'Help & Support'
    return 'Estimate AI'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
          'lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className={cn(
          'flex h-16 items-center border-b border-gray-200 px-4',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white font-bold shadow-sm">
                E
              </div>
              <span className="font-semibold text-gray-900">Estimate AI</span>
            </div>
          )}

          {sidebarCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white font-bold shadow-sm">
              E
            </div>
          )}

          {/* Collapse button (desktop) */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "hidden lg:flex items-center justify-center h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors",
              sidebarCollapsed && "absolute -right-3 top-4 bg-white border border-gray-200 shadow-sm"
            )}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Close button (mobile) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* New Project Button */}
          <button
            onClick={() => navigate('/projects/new')}
            className={cn('sidebar-new-quote-btn', sidebarCollapsed && 'px-2')}
          >
            <Plus className="h-4 w-4" />
            {!sidebarCollapsed && 'New Project'}
          </button>

          {/* Main Navigation */}
          <div className="sidebar-nav-section">
            {mainNavItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="sidebar-footer">
          <div className="sidebar-nav-section">
            {bottomNavItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="header shadow-sm">
          {/* Left side */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center h-10 w-10 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Page Title */}
            <h1 className="text-xl font-semibold text-gray-900">
              {getPageTitle()}
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Search (hidden on mobile) */}
            <div className="hidden md:flex items-center">
              <div className="header-search">
                <Search className="header-search-icon" />
                <input
                  type="search"
                  placeholder="Search projects, quotes..."
                  className="header-search-input"
                />
              </div>
            </div>

            {/* Notifications */}
            <button
              className="relative flex items-center justify-center h-10 w-10 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error-500 ring-2 ring-white" />
            </button>

            {/* Divider */}
            <div className="hidden md:block h-8 w-px bg-gray-200 mx-1" />

            {/* User Menu */}
            <UserMenu />
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
