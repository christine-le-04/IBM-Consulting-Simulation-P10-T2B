import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown } from '@carbon/icons-react'
import { useAuthStore } from '@/store/authStore'
import styles from './adminNavigation.module.scss'

interface AdminLink {
  to: string
  label: string
  end?: boolean
  roles: string[]
}

interface AdminGroup {
  label: string
  links: AdminLink[]
}

const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: 'Learning design',
    links: [
      { to: '/dashboard/admin/scenarios', label: 'Learning journeys', roles: ['SCENARIO_AUTHOR', 'ADMINISTRATOR'] },
      { to: '/dashboard/admin/achievements', label: 'Progression and badges', roles: ['ADMINISTRATOR'] },
    ],
  },
  {
    label: 'People',
    links: [
      { to: '/dashboard/admin/users', label: 'People and access', roles: ['ADMINISTRATOR'] },
      { to: '/dashboard/admin/learners', label: 'Learner progress', roles: ['ADMINISTRATOR'] },
    ],
  },
  {
    label: 'Operations',
    links: [
      { to: '/dashboard/admin/ai-operations', label: 'AI delivery', roles: ['REVIEWER', 'ADMINISTRATOR'] },
      { to: '/dashboard/admin/audit-log', label: 'Audit log', roles: ['ADMINISTRATOR'] },
    ],
  },
  {
    label: 'Communication',
    links: [
      { to: '/dashboard/admin/announcements', label: 'Announcements', roles: ['ADMINISTRATOR'] },
    ],
  },
]

export default function AdminNavigation() {
  const [open, setOpen] = useState(false)
  const role = useAuthStore((state) => state.role)
  const groups = ADMIN_GROUPS
    .map((group) => ({ ...group, links: group.links.filter((link) => role && link.roles.includes(role)) }))
    .filter((group) => group.links.length > 0)

  return (
    <div className={styles.navigation}>
      <button
        type="button"
        className={styles.mobileToggle}
        aria-expanded={open}
        aria-controls="admin-navigation-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Admin navigation</span>
        <ChevronDown size={16} className={open ? styles.chevronOpen : undefined} />
      </button>
      {open && <button type="button" className={styles.backdrop} aria-label="Close admin navigation" onClick={() => setOpen(false)} />}
      <nav
        id="admin-navigation-panel"
        className={`${styles.rail} ${open ? styles.railOpen : ''}`}
        aria-label="Admin navigation"
      >
        <NavLink
          to="/dashboard/admin"
          end
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          onClick={() => setOpen(false)}
        >
          Overview
        </NavLink>
        {groups.map((group) => (
          <section className={styles.group} key={group.label} aria-label={group.label}>
            <h2>{group.label}</h2>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
    </div>
  )
}
