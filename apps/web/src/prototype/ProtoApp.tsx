import ProtoHeader from './shell/ProtoHeader'
import { ManagerLine } from './shell/EngagementStrip'
import StepThreshold from './shell/StepThreshold'
import OfficeMap from './shell/OfficeMap'
import CaseFilePanel from './shell/CaseFilePanel'
import PrototypeBar from './shell/PrototypeBar'
import LandingScreen from './screens/landing/LandingScreen'
import HubScreen from './screens/HubScreen'
import ChooseClientScreen from './screens/ChooseClientScreen'
import ResearchDeskScreen from './screens/research/ResearchDeskScreen'
import MailScreen from './screens/mail/MailScreen'
import PrepareScreen from './screens/PrepareScreen'
import MeetingScreen from './screens/MeetingScreen'
import ProposalScreen from './screens/ProposalScreen'
import DecisionScreen from './screens/DecisionScreen'
import AssessmentScreen from './screens/AssessmentScreen'
import PortfolioScreen from './screens/PortfolioScreen'
import { useProto } from './state/protoStore'
import { isEngagementScreen, type ScreenId } from './state/stages'
import styles from './shell/shell.module.scss'

const SCREENS: Record<ScreenId, () => JSX.Element> = {
  LANDING: LandingScreen,
  HUB: HubScreen,
  LEAD: ChooseClientScreen,
  RESEARCH: ResearchDeskScreen,
  OUTREACH: MailScreen,
  PREPARE: PrepareScreen,
  MEETING: MeetingScreen,
  PROPOSAL: ProposalScreen,
  DECISION: DecisionScreen,
  ASSESSMENT: AssessmentScreen,
  PORTFOLIO: PortfolioScreen,
}

/**
 * Mirrors AppShell: the Carbon header, then — on engagement screens only — the
 * strip and the threshold rendered outside the page, exactly where AppShell
 * already renders <EngagementHUD /> outside <Outlet /> today.
 */
export default function ProtoApp() {
  const screen = useProto((s) => s.screen)
  const Screen = SCREENS[screen]
  const onEngagement = isEngagementScreen(screen)

  // The landing page brings its own public header, as LandingPage does today.
  if (screen === 'LANDING') {
    return (
      <>
        <LandingScreen />
        <PrototypeBar />
      </>
    )
  }

  return (
    <>
      <ProtoHeader />
      <div className={styles.shell}>
        {onEngagement && <ManagerLine />}
        {onEngagement && <StepThreshold />}
        <main id="main-content" className={styles.content}>
          <Screen key={screen} />
        </main>
      </div>
      <OfficeMap />
      <CaseFilePanel />
      <PrototypeBar />
    </>
  )
}
