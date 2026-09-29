import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderMenuButton,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SkipToContent,
  Content,
} from '@carbon/react'
import { Logout } from '@carbon/icons-react'
import { useAuthStore } from '@/store/authStore'
import { isEngagementRoute } from '@/lifecycle/phases'
import CaseFilePanel from '@/components/shell/CaseFilePanel'
import EngagementBar from '@/components/shell/EngagementBar'
import MentorLine from '@/components/shell/MentorLine'
import OfficeMap from '@/components/shell/OfficeMap'
import StepBrief from '@/components/shell/StepBrief'
import { useShellStore } from '@/components/shell/shellStore'
import shell from '@/components/shell/shell.module.scss'
import styles from '@/lifecycle/lifecycle.module.scss'

/**
 * The app frame. "Command Centre" is now the Office. On an engagement page the
 * engagement bar sits inside the header, with the mentor's line and the step
 * brief beneath it, so the page gives up one header's height rather than two.
 * Portfolio and logout stay pinned at the right on every page.
 */
export default function AppShell() {
  const { displayName, role, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const canAccessAdmin = role === 'SCENARIO_AUTHOR' || role === 'REVIEWER' || role === 'ADMINISTRATOR'
  const onEngagement = isEngagementRoute(location.pathname)
  const usesFixedCanvas = /^\/dashboard\/engagements\/[^/]+\/(intelligence|outreach|preparation|proposal)$/.test(location.pathname)
    || /^\/dashboard\/engagements\/[^/]+\/meetings\/[^/]+$/.test(location.pathname)
  // Carbon hides HeaderNavigation below 1056px and hides this button above it,
  // so exactly one of the two is on screen at any width.
  const [navOpen, setNavOpen] = useState(false)

  // Overlays belong to the page they were opened on.
  const setMapOpen = useShellStore((s) => s.setMapOpen)
  const setCaseFileOpen = useShellStore((s) => s.setCaseFileOpen)
  useEffect(() => {
    setMapOpen(false)
    setCaseFileOpen(false)
  }, [location.pathname, setMapOpen, setCaseFileOpen])

  // Declared once and rendered twice — the wide header bar and the narrow panel
  // can never drift apart.
  const links = [
    { to: '/dashboard', label: 'Office', end: true },
    ...(canAccessAdmin ? [{ to: '/dashboard/admin', label: 'Admin Console', end: false }] : []),
  ]
  const mobileLinks = [...links, { to: '/dashboard/portfolio', label: 'Portfolio', end: false }]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <SkipToContent />
      <Header aria-label="IBM Consulting Simulation" className={onEngagement ? shell.headerEngagement : undefined}>
        <HeaderMenuButton
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          isActive={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        />
        <HeaderName href="/dashboard" prefix="IBM">
          Consulting Sim
        </HeaderName>
        <HeaderNavigation aria-label="Main navigation">
          {links.map((link) => (
            <HeaderMenuItem key={link.to} as={NavLink} to={link.to} end={link.end}>
              {link.label}
            </HeaderMenuItem>
          ))}
        </HeaderNavigation>
        {onEngagement && <EngagementBar />}
        <HeaderGlobalBar className={shell.globalBar}>
          <NavLink
            to="/dashboard/portfolio"
            className={({ isActive }) => `${shell.portfolioLink} ${isActive ? shell.portfolioLinkActive : ''}`}
          >
            Portfolio
          </NavLink>
          <HeaderGlobalAction
            aria-label={`Logout ${displayName ?? ''}`}
            tooltipAlignment="end"
            onClick={handleLogout}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      {navOpen && (
        <nav className={styles.mobileNav} aria-label="Main navigation">
          {mobileLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ''}`
              }
              onClick={() => setNavOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}

      <div className={`${styles.fixedShellRoot} ${shell.shellRoot}`}>
        {onEngagement && <MentorLine />}
        {onEngagement && <StepBrief />}
        <Content className={`${styles.shellContent} ${usesFixedCanvas ? styles.fixedShellContent : ''}`}>
          <Outlet />
        </Content>
      </div>

      {onEngagement && <OfficeMap />}
      {onEngagement && <CaseFilePanel />}
    </>
  )
}
