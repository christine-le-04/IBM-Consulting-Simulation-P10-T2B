/**
 * Research the client — design doc §3 and §4 screen 3.
 *
 * Four of the five progress systems go (the metric tiles, readiness band,
 * Research Flow and the gate checklist). The manager's line in the strip says
 * what is missing. The widest region shows the source being read, one at a
 * time; everything else waits in a side panel that closes (rules R2, R3).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@carbon/react'
import { Add, ChevronLeft, OpenPanelFilledRight } from '@carbon/icons-react'
import type { EvidenceType, ResearchSourceBlock } from '@/api/types'
import { gateFor, readinessFor, RESEARCH_AREAS, SOURCES } from '../../data/research'
import { useProto } from '../../state/protoStore'
import CompanyFile from '../../shell/CompanyFile'
import EvidenceRegister from '../../shell/EvidenceRegister'
import SourceDocument, { TRUST_LABEL } from './SourceDocument'
import ClipForm, { type ClipValues } from './ClipForm'
import HypothesisTab from './HypothesisTab'
import ManualSourceForm from './ManualSourceForm'
import styles from './research.module.scss'

type Tab = 'company' | 'sources' | 'evidence' | 'hypothesis'

interface Clip {
  snippet: string
  blockId: string | null
}

export default function ResearchDeskScreen() {
  const evidence = useProto((s) => s.evidence)
  const addEvidence = useProto((s) => s.addEvidence)
  const set = useProto((s) => s.set)
  const [sourceId, setSourceId] = useState(SOURCES[0].id)
  const [area, setArea] = useState<EvidenceType>('COMPANY_NEWS')
  const [tab, setTab] = useState<Tab>('company')
  const [panelOpen, setPanelOpen] = useState(true)
  const [clip, setClip] = useState<Clip | null>(null)
  const [manual, setManual] = useState(false)
  const [savedBlocks, setSavedBlocks] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null)

  const readingRef = useRef<HTMLDivElement>(null)
  // A new source opens at its top, like turning to a new document.
  useEffect(() => { readingRef.current?.scrollTo({ top: 0 }) }, [sourceId])
  const index = SOURCES.findIndex((source) => source.id === sourceId)
  const source = SOURCES[index]
  const gate = gateFor(evidence)
  const findings = evidence.filter((item) => item.evidenceType !== 'HYPOTHESIS')

  // The strip speaks the gate's coaching line instead of a checklist.
  const managerLine = gate.coaching[0] ?? null
  useEffect(() => { set({ liveLine: managerLine }) }, [managerLine, set])
  // Research is feedback only: the way on is always offered, and turns
  // primary once the essentials are there.
  useEffect(() => {
    const status = gateFor(evidence)
    set({
      nextStep: {
        label: 'Choose who to contact', screen: 'LEAD', ready: status.ready,
        checklist: readinessFor(status), checklistTitle: 'Before you contact the client', stayLabel: 'Keep researching',
      },
    })
  }, [evidence, set])

  const onSelection = useCallback((text: string, rect: DOMRect | null) => {
    setSelection(text && rect ? { text, rect } : null)
  }, [])

  const openClip = (snippet: string, blockId: string | null) => {
    setClip({ snippet, blockId })
    setManual(false)
    setPanelOpen(true)
    setSelection(null)
    document.getSelection()?.removeAllRanges()
  }

  const saveClip = (values: ClipValues) => {
    if (!clip) return
    addEvidence({
      note: `${clip.snippet}\n\nConsulting takeaway: ${values.takeaway}`,
      hypothesis: null,
      evidenceType: source.evidenceType,
      sourceUrl: null,
      sourceTitle: source.title,
      origin: source.origin,
      verificationStatus: values.verification,
      occurredOn: source.publishedOn,
      confidence: values.confidence,
      relevanceScore: source.relevanceScore,
      reasoningLane: values.lane,
      supportingEvidenceIds: [],
    })
    if (clip.blockId) setSavedBlocks(new Set(savedBlocks).add(clip.blockId))
    setClip(null)
    setTab('evidence')
  }

  const areaSources = useMemo(() => SOURCES.filter((item) => item.evidenceType === area), [area])
  const move = (direction: -1 | 1) => setSourceId(SOURCES[(index + direction + SOURCES.length) % SOURCES.length].id)

  return (
    <div className={styles.desk}>
      <div className={styles.reading} ref={readingRef}>
        <SourceDocument
          key={source.id}
          source={source}
          index={index}
          total={SOURCES.length}
          savedBlockIds={savedBlocks}
          onSaveBlock={(block: ResearchSourceBlock) => openClip(block.content, block.id)}
          onSelection={onSelection}
          onMove={move}
        />
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
        {clip ? (
          <div className={styles.panelBody}>
            <ClipForm source={source} snippet={clip.snippet} onCancel={() => setClip(null)} onSave={saveClip} />
          </div>
        ) : (
          <>
            <div className={styles.tabs} role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'company'} onClick={() => setTab('company')}>Company</button>
              <button type="button" role="tab" aria-selected={tab === 'sources'} onClick={() => setTab('sources')}>Sources <span>{SOURCES.length}</span></button>
              <button type="button" role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>Evidence <span>{findings.length}</span></button>
              <button type="button" role="tab" aria-selected={tab === 'hypothesis'} onClick={() => setTab('hypothesis')}>Hypothesis</button>
              <button type="button" className={styles.close} onClick={() => setPanelOpen(false)} aria-label="Close the panel">✕</button>
            </div>
            <div className={styles.panelBody}>
              {tab === 'company' && <CompanyFile />}

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
                    {areaSources.map((item) => (
                      <button key={item.id} type="button" className={`${styles.sourceItem} ${item.id === source.id ? styles.sourceItemReading : ''}`} onClick={() => setSourceId(item.id)}>
                        <span className={styles.sourceIndex}>{SOURCES.indexOf(item) + 1}</span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.sourceType} · {item.publishedOn}</small>
                          <small className={styles[`trustText_${item.confidence}`]}>{TRUST_LABEL[item.confidence]}{item.id === source.id ? ' · reading now' : ''}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tab === 'evidence' && (
                manual ? <ManualSourceForm onDone={() => setManual(false)} /> : (
                  <>
                    <div className={styles.evidenceHead}>
                      <p className={styles.panelEyebrow}>Evidence board</p>
                      <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => setManual(true)}>Add source</Button>
                    </div>
                    <EvidenceRegister />
                  </>
                )
              )}

              {tab === 'hypothesis' && <HypothesisTab />}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
