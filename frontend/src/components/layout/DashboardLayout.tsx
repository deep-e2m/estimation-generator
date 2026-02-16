/**
 * Dashboard Layout
 *
 * Main application layout with:
 * - Animated hover-to-expand sidebar
 * - Pin button to lock sidebar open
 * - Smooth Framer Motion animations
 * - Header with user menu
 * - Main content area
 */

import { useState, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Pin,
  PinOff,
} from 'lucide-react'

import { useAuthStore, useUser } from '@/store/authStore'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

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

// Sidebar navigation link component with tooltip
function NavItem({
  href,
  icon: Icon,
  label,
  isExpanded,
}: {
  href: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  isExpanded: boolean
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <NavLink
        to={href}
        className={({ isActive }) =>
          cn('nav-item', isActive && 'nav-item-active', !isExpanded && 'nav-item-collapsed')
        }
        onMouseEnter={() => !isExpanded && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <motion.div
          initial={false}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon className="nav-item-icon" style={{ width: 22, height: 22, flexShrink: 0 }} />
        </motion.div>
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.span
              className="nav-item-label"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </NavLink>

      {/* Tooltip when collapsed */}
      <AnimatePresence>
        {showTooltip && !isExpanded && (
          <motion.div
            className="nav-tooltip"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    <div className="user-menu">
      <button
        onClick={() => setOpen(!open)}
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar
          src={user?.avatar_url}
          alt={user?.full_name || 'User'}
          size="sm"
        />
        <div className="user-menu-info md:block hidden">
          <p className="user-menu-name">
            {user?.full_name || 'User'}
          </p>
          <p className="user-menu-email">
            {user?.email}
          </p>
        </div>
        <ChevronDown 
          className="md:block hidden"
          style={{ 
            width: 16, 
            height: 16, 
            color: 'var(--color-gray-400)',
            transition: 'transform var(--transition-fast)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }} 
        />
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
          <div className="user-menu-dropdown">
            <div className="user-menu-header">
              <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
              <span className="user-menu-role">
                {user?.role}
              </span>
            </div>

            <div style={{ padding: '8px 0' }}>
              <NavLink
                to="/settings/profile"
                className="dropdown-item"
                onClick={() => setOpen(false)}
              >
                <Settings style={{ width: 16, height: 16, color: 'var(--color-gray-500)' }} />
                Account Settings
              </NavLink>
            </div>

            <div style={{ borderTop: '1px solid var(--color-gray-100)', padding: '8px 0' }}>
              <button
                onClick={handleLogout}
                className="dropdown-item dropdown-item-danger"
                style={{ width: '100%' }}
              >
                <LogOut style={{ width: 16, height: 16 }} />
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
  const [isPinned, setIsPinned] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  // Sidebar is expanded when pinned OR hovered
  const isExpanded = isPinned || isHovered

  // Global search: navigate to projects with search param (DB-backed list)
  const handleGlobalSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = globalSearchQuery.trim()
      if (q) {
        navigate(`/projects?search=${encodeURIComponent(q)}`)
        setGlobalSearchQuery('')
      } else {
        navigate('/projects')
      }
    },
    [globalSearchQuery, navigate]
  )

  // Handle mouse events for hover-to-expand
  const handleMouseEnter = useCallback(() => {
    if (!isPinned) {
      setIsHovered(true)
    }
  }, [isPinned])

  const handleMouseLeave = useCallback(() => {
    if (!isPinned) {
      setIsHovered(false)
    }
  }, [isPinned])

  // Get current page title
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path.startsWith('/projects')) return 'Projects'
    if (path.startsWith('/settings')) return 'Settings'
    if (path.startsWith('/help')) return 'Help & Support'
    return 'Estimate AI'
  }

  // Sidebar animation variants
  const sidebarVariants = {
    collapsed: {
      width: 72, // var(--sidebar-collapsed-width)
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }
    },
    expanded: {
      width: 260, // var(--sidebar-width)
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }
    }
  }

  return (
    <div className="layout">
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'block' }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          'sidebar',
          isExpanded && 'sidebar-expanded',
          sidebarOpen && 'sidebar-open'
        )}
        variants={sidebarVariants}
        initial="collapsed"
        animate={isExpanded || sidebarOpen ? 'expanded' : 'collapsed'}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <motion.div 
              className="sidebar-logo-icon"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              E
            </motion.div>
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  className="sidebar-logo-text"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  Estimate AI
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Pin button (desktop) - only show when expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.button
                onClick={() => setIsPinned(!isPinned)}
                className={cn('sidebar-pin', isPinned && 'sidebar-pin-active')}
                aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title={isPinned ? 'Unpin sidebar' : 'Pin sidebar to keep open'}
              >
                {isPinned ? (
                  <PinOff style={{ width: 16, height: 16 }} />
                ) : (
                  <Pin style={{ width: 16, height: 16 }} />
                )}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Close button (mobile) - shown via CSS on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close-btn"
            aria-label="Close sidebar"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* New Project Button */}
          <motion.button
            onClick={() => navigate('/projects/new')}
            className="nav-button-primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus style={{ width: 20, height: 20, flexShrink: 0 }} />
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  New Project
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Main Navigation */}
          <div className="sidebar-section">
            {mainNavItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <NavItem
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isExpanded={isExpanded}
                />
              </motion.div>
            ))}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="sidebar-footer">
          {bottomNavItems.map((item, index) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <NavItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                isExpanded={isExpanded}
              />
            </motion.div>
          ))}
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <motion.div
        className={cn('main-wrapper', isPinned && 'main-wrapper-pinned')}
        initial={false}
        animate={{
          marginLeft: isPinned ? 260 : 72
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Header */}
        <header className="header">
          {/* Left side */}
          <div className="header-left">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="header-icon-btn"
              aria-label="Open sidebar"
              style={{ display: 'none' }}
            >
              <Menu style={{ width: 24, height: 24 }} />
            </button>

            {/* Page Title */}
            <motion.h1
              className="header-title"
              key={getPageTitle()}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {getPageTitle()}
            </motion.h1>
          </div>

          {/* Right side */}
          <div className="header-right">
            {/* Search: navigates to Projects with search param for DB-backed results */}
            <form className="header-search" style={{ display: 'flex' }} onSubmit={handleGlobalSearchSubmit}>
              <Search style={{ width: 16, height: 16, color: 'var(--color-gray-400)', flexShrink: 0 }} />
              <input
                type="search"
                placeholder="Search projects..."
                className="header-search-input"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                aria-label="Search projects"
              />
            </form>

            {/* Notifications */}
            <motion.button
              className="header-icon-btn"
              aria-label="Notifications"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bell style={{ width: 20, height: 20 }} />
              <span className="header-icon-btn-badge" />
            </motion.button>

            {/* Divider */}
            <div style={{ height: 32, width: 1, backgroundColor: 'var(--color-gray-200)', margin: '0 4px' }} />

            {/* User Menu */}
            <UserMenu />
          </div>
        </header>

        {/* Main Content */}
        <main className="page-content">
          <div className={cn(
            'page-container', 
            location.pathname === '/dashboard' && 'dashboard-container',
            location.pathname === '/projects' && 'projects-container'
          )}>
            <Outlet />
          </div>
        </main>
      </motion.div>
    </div>
  )
}
