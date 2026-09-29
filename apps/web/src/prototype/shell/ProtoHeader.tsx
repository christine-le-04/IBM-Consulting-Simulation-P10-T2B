import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  SkipToContent,
} from '@carbon/react'
import { Logout } from '@carbon/icons-react'
import { useProto } from '../state/protoStore'
import { LEARNER_NAME } from '../data/scenario'
import { isEngagementScreen } from '../state/stages'
import { EngagementBar } from './EngagementStrip'
import styles from './shell.module.scss'

/**
 * Same Carbon header as AppShell. "Command Centre" becomes "Office": the hub
 * replaces that page outright (design doc §4, screen 1).
 *
 * On engagement screens the strip moves into this bar, so the page loses one
 * header's height, not two. Portfolio stays pinned at the right in every view,
 * so it is always in the same place.
 */
export default function ProtoHeader() {
  const screen = useProto((s) => s.screen)
  const go = useProto((s) => s.go)
  const onEngagement = isEngagementScreen(screen)

  return (
    <Header aria-label="IBM Consulting Simulation" className={onEngagement ? styles.headerEngagement : undefined}>
      <SkipToContent />
      <HeaderName href="#" prefix="IBM" onClick={(event) => { event.preventDefault(); go('HUB') }}>
        Consulting Sim
      </HeaderName>
      <HeaderNavigation aria-label="Main navigation">
        <HeaderMenuItem href="#" isActive={screen !== 'PORTFOLIO'} onClick={(event) => { event.preventDefault(); go('HUB') }}>
          Office
        </HeaderMenuItem>
      </HeaderNavigation>
      {onEngagement && <EngagementBar />}
      <HeaderGlobalBar className={styles.globalBar}>
        <a
          href="#"
          className={`${styles.portfolioLink} ${screen === 'PORTFOLIO' ? styles.portfolioLinkActive : ''}`}
          onClick={(event) => { event.preventDefault(); go('PORTFOLIO') }}
        >
          Portfolio
        </a>
        <HeaderGlobalAction aria-label={`Logout ${LEARNER_NAME}`} tooltipAlignment="end">
          <Logout size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  )
}
