/**
 * Research the client — the research desk.
 *
 * The widest region shows the source being read, one at a time, skinned as the
 * document it is; everything else waits in a side panel that closes: the
 * company file, the source list, the evidence board and the hypothesis. The
 * metric tiles, readiness band and gate checklist are gone (SRS FR-14: no
 * numbers during play) — Dana's line says what is missing, and the way on sits
 * beside it with the same checklist in words.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, InlineLoading, InlineNotification } from '@carbon/react'
import { Add, ChevronLeft, OpenPanelFilledRight, Search } from '@carbon/icons-react'
import { useEngagement } from '@/api/hooks/useEngagements'
import { useCompleteResearch, useResearch, useResearchGateStatus, useResearchSourceDeck, useSaveResearch } from '@/api/hooks/useLeads'
import type { EvidenceType, ResearchSourceBlock, SaveResearchPayload } from '@/api/types'
import { getApiProblem } from '@/api/problemDetails'
import LoadError from '@/components/shared/LoadError'
import LoadingState from '@/components/shared/LoadingState'
import ObjectiveTourProvider from '@/components/shared/ObjectiveTourProvider'
import CompanyFile from '@/components/shell/CompanyFile'
import EvidenceRegister from '@/components/shell/EvidenceRegister'
import { usableEvidence } from '@/components/shell/evidence'
import { useMentor } from '@/components/shell/useMentor'
import { isBackFromFailedOutreach } from '@/lifecycle/contactSelection'
import ClipForm, { type ClipValues } from './ClipForm'
import HypothesisTab from './HypothesisTab'
import ManualSourceForm from './ManualSourceForm'
import { deckSources, readinessFor, RESEARCH_AREAS, TRUST_LABEL } from './research'
import SourceDocument from './SourceDocument'
import styles from './ClientIntelligencePage.module.scss'

/** The walkthrough: where things are, never what to conclude. */
const CLIENT_INTELLIGENCE_OBJECTIVES = [
  {
    id: 'source',
    objective: 'Read the client’s sources',
    description: 'One source at a time, as the real document. Press Save beside a passage, or highlight part of it, to add it to your evidence.',
    targets: ['.objective-source'],
  },
  {
    id: 'panel',
    objective: 'Your research panel',
    description: 'The company file, every source, your evidence board and your hypothesis live here. Close it to read full width.',
    targets: ['.objective-research-panel'],
  },
  {
    id: 'hypothesis',
    objective: 'Form a grounded hypothesis',
    description: 'When the pattern is clear, say what the client’s real problem is and cite the evidence behind it. The checklist there shows what is still missing.',
    targets: ['.objective-hypothesis'],
  },
]

type Tab = 'company' | 'sources' | 'evidence' | 'hypothesis'

interface Clip {
  snippet: string
  blockId: string | null
}

export default function ClientIntelligencePage() {
  const { engagementId = '' } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const { data: engagement } = useEngagement(engagementId)
  const { data: evidence, isLoading, isError, error, refetch } = useResearch(engagementId)
  const saveResearch = useSaveResearch(engagementId)
  const { data: gate } = useResearchGateStatus(engagementId)
  const completeResearch = useCompleteResearch(engagementId)
  const sourceDeck = useResearchSourceDeck(engagementId)

  const sources = useMemo(() => deckSources(sourceDeck.data), [sourceDeck.data])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [area, setArea] = useState<EvidenceType>('COMPANY_NEWS')
  const [tab, setTab] = useState<Tab>('company')
  const [panelOpen, setPanelOpen] = useState(true)
  const [clip, setClip] = useState<Clip | null>(null)
  // A passage the learner asked to save while a written draft was still open.
  const [pendingClip, setPendingClip] = useState<Clip | null>(null)
  const [clipDirty, setClipDirty] = useState(false)
  const [manual, setManual] = useState(false)
  const [savedBlocks, setSavedBlocks] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null)

  const index = Math.max(0, sources.findIndex((item) => item.id === sourceId))
  const source = sources[index]
  const findings = usableEvidence(evidence)

  const readingRef = useRef<HTMLDivElement>(null)
  // A new source opens at its top, like turning to a new document.
  useEffect(() => { readingRef.current?.scrollTo({ top: 0 }) }, [source?.id])

  const toContact = () => navigate(`/dashboard/engagements/${engagementId}/contact`)
  
  const proceed = () => {
    if (gate?.researchCompleted) return toContact()
    completeResearch.mutate(undefined, { onSuccess: toContact })
  }

  // Dana speaks the gate's own coaching; the way on sits beside her.
  useMentor(
    completeResearch.isError
      // 422 is the gate refusing; anything else never reached it.
      ? getApiProblem(completeResearch.error, '').status === 422
        ? 'The engagement could not move on yet. Tick off what is missing, then try again.'
        : 'The engagement could not move on just now. Your research is saved; check your connection, then try again.'
      : isBackFromFailedOutreach(engagement)
        ? 'Nobody agreed to meet. Your research is still here: look again at who can actually say yes.'
        : gate?.coaching?.[0] ?? (gate?.ready ? 'You have enough to go on. Now decide who can actually say yes.' : null),
    {
      label: completeResearch.isPending ? 'Advancing…' : `Choose who to contact`,
      ready: Boolean(gate?.ready),
      checklist: readinessFor(gate),
      checklistTitle: 'Before you contact the client',
      stayLabel: 'Keep researching',
      // The backend still refuses outreach until the gate is met.
      allowEarly: false,
      onGo: proceed,
    },
  )

  const onSelection = useCallback((text: string, rect: DOMRect | null) => {
    setSelection(text && rect ? { text, rect } : null)
  }, [])

  const openClip = (snippet: string, blockId: string | null) => {
    setManual(false)
    setPanelOpen(true)
    setSelection(null)
    document.getSelection()?.removeAllRanges()
    // Replacing a draft with a written takeaway used to lose it silently.
    if (clip && clipDirty && clip.snippet !== snippet) {
      setPendingClip({ snippet, blockId })
      return
    }
    setPendingClip(null)
    setClipDirty(false)
    setClip({ snippet, blockId })
  }

  const closeClip = () => {
    setClip(null)
    setPendingClip(null)
    setClipDirty(false)
  }

  const save = (payload: SaveResearchPayload, onDone: () => void) => saveResearch.mutate(payload, { onSuccess: onDone })

  const saveClip = (values: ClipValues) => {
    if (!clip || !source) return
    save(
      {
        note: `${clip.snippet}\n\nConsulting takeaway: ${values.takeaway}`,
        evidenceType: source.evidenceType,
        sourceTitle: source.title,
        origin: source.origin,
        verificationStatus: values.verification,
        occurredOn: source.publishedOn,
        confidence: values.confidence,
        relevanceScore: source.relevanceScore,
        reasoningLane: values.lane,
      },
      () => {
        if (clip.blockId) setSavedBlocks((current) => new Set(current).add(clip.blockId!))
        closeClip()
        setTab('evidence')
      },
    )
  }

  const move = (direction: -1 | 1) => {
    if (sources.length < 2) return
    setSourceId(sources[(index + direction + sources.length) % sources.length].id)
  }

  if (isLoading) return <LoadingState />
  if (isError) return <LoadError title="Research could not be opened" error={error} reassurance="Your saved evidence is safe." onRetry={() => void refetch()} />

  const areaSources = sources.filter((item) => item.evidenceType === area)

  return (
    <ObjectiveTourProvider tourId="client-intelligence" objectives={CLIENT_INTELLIGENCE_OBJECTIVES}>
      <div className={styles.desk}>
        <div className={`${styles.reading} objective-source`} ref={readingRef}>
          {source ? (
            <SourceDocument
              key={source.id}
              source={source}
              index={index}
              total={sources.length}
              savedBlockIds={savedBlocks}
              onSaveBlock={(block: ResearchSourceBlock) => openClip(block.content, block.id)}
              onSelection={onSelection}
              onMove={move}
            />
          ) : (
            <div className={styles.readingEmpty}>
              <Search size={24} />
              {sourceDeck.isFetching || sourceDeck.data?.enrichmentPending ? (
                <>
                  <InlineLoading description="Preparing the client’s sources…" />
                  {/* The first load of a new client can take several seconds; say so, so it does not look stuck. */}
                  <span className={styles.readingWait}>The first time, this can take up to 15 seconds while the documents are gathered.</span>
                </>
              ) : (
                <span>No sources are available for this client yet.</span>
              )}
            </div>
          )}
          {sourceDeck.isError && (
            <InlineNotification kind="error" lowContrast hideCloseButton title="Sources could not be opened" subtitle="Check your connection, then retry. Your existing evidence is unchanged." />
          )}
        </div>

        {selection && (
          <button
            type="button"
            className={styles.saver}
            style={{ left: Math.min(Math.max(selection.rect.left + selection.rect.width / 2, 100), window.innerWidth - 100), top: Math.max(selection.rect.top - 10, 120) }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openClip(selection.text, null)}
          >
            Save as evidence
          </button>
        )}

        {!panelOpen && (
          <button type="button" className={styles.panelOpener} onClick={() => setPanelOpen(true)} aria-label="Open the research panel">
            <ChevronLeft size={20} aria-hidden="true" />
            <OpenPanelFilledRight size={24} aria-hidden="true" />
            <span className={styles.openerText}>Research panel</span>
            <span className={styles.openerCount}>{findings.length}</span>
          </button>
        )}

        <aside className={`${styles.panel} ${panelOpen ? '' : styles.panelClosed}`} aria-label="Research panel">
          {clip && source ? (
            <div className={styles.panelBody}>
              {pendingClip && (
                <div className={styles.clipSwitch} role="alert">
                  <p>You have not added this evidence yet. Opening the new passage will discard your takeaway.</p>
                  <div className={styles.clipActions}>
                    <Button kind="secondary" size="sm" onClick={() => setPendingClip(null)}>Keep this draft</Button>
                    <Button kind="danger--tertiary" size="sm" onClick={() => { setClipDirty(false); setClip(pendingClip); setPendingClip(null) }}>Discard and open new passage</Button>
                  </div>
                </div>
              )}
              <ClipForm key={clip.snippet} source={source} snippet={clip.snippet} saving={saveResearch.isPending} onCancel={closeClip} onSave={saveClip} onDirtyChange={setClipDirty} />
            </div>
          ) : (
            <>
              <div className={`${styles.tabs} objective-research-panel`} role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'company'} onClick={() => setTab('company')}>Company</button>
                <button type="button" role="tab" aria-selected={tab === 'sources'} onClick={() => setTab('sources')}>Sources <span>{sources.length}</span></button>
                <button type="button" role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>Evidence <span>{findings.length}</span></button>
                <button type="button" role="tab" className="objective-hypothesis" aria-selected={tab === 'hypothesis'} onClick={() => setTab('hypothesis')}>Hypothesis</button>
                <button type="button" className={styles.close} onClick={() => setPanelOpen(false)} aria-label="Close the panel">✕</button>
              </div>
              <div className={styles.panelBody}>
                {tab === 'company' && engagement && <CompanyFile engagement={engagement} />}

                {tab === 'sources' && (
                  <>
                    <div className={styles.areas} role="group" aria-label="Research areas">
                      {RESEARCH_AREAS.map((item) => {
                        const count = findings.filter((entry) => entry.evidenceType === item.type).length
                        return (
                          <button key={item.type} type="button" className={area === item.type ? styles.areaActive : styles.area} onClick={() => setArea(item.type)} title={item.prompt}>
                            {item.label}
                            {count > 0 && <span>{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                    <p className={styles.help}>{RESEARCH_AREAS.find((item) => item.type === area)?.prompt}</p>
                    <div className={styles.sourceList}>
                      {areaSources.length === 0 && <p className={styles.help}>No sources in this area yet.</p>}
                      {areaSources.map((item) => (
                        <button key={item.id} type="button" className={`${styles.sourceItem} ${item.id === source?.id ? styles.sourceItemReading : ''}`} onClick={() => setSourceId(item.id)}>
                          <span className={styles.sourceIndex}>{sources.indexOf(item) + 1}</span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.sourceType} · {item.publishedOn}</small>
                            <small className={styles[`trustText_${item.confidence}`]}>{TRUST_LABEL[item.confidence]}{item.id === source?.id ? ' · reading now' : ''}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'evidence' && (
                  manual ? (
                    <ManualSourceForm saving={saveResearch.isPending} onCancel={() => setManual(false)} onSave={(payload) => save(payload, () => setManual(false))} />
                  ) : (
                    <>
                      <div className={styles.evidenceHead}>
                        <p className={styles.panelEyebrow}>Evidence board</p>
                        <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => setManual(true)}>Add source</Button>
                      </div>
                      <EvidenceRegister evidence={evidence} />
                    </>
                  )
                )}

                {tab === 'hypothesis' && <HypothesisTab evidence={evidence ?? []} saving={saveResearch.isPending} onSave={save} />}

                {saveResearch.isError && (
                  <InlineNotification kind="error" lowContrast hideCloseButton title="Not saved" subtitle="Your evidence could not be saved. Check your connection and try again." />
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </ObjectiveTourProvider>
  )
}
