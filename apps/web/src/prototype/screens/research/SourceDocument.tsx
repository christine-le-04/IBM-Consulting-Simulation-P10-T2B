/**
 * One source, full width, read like the real document it is (design doc §3,
 * rule R3). The four templates and their section names are the ones
 * ClientIntelligencePage already renders: The Client Observer (news),
 * Decision Context File (stakeholder), Commercial Signal Note (financial) and
 * Technical Due Diligence (technology).
 *
 * Only FACT blocks are selectable, as today. Trust is a word, not a relevance
 * percentage: numbers wait for the debrief (R4).
 */
import { useEffect, useRef } from 'react'
import { Bookmark, ChevronLeft, ChevronRight } from '@carbon/icons-react'
import type { ResearchArtifact, ResearchSourceBlock } from '@/api/types'
import styles from './research.module.scss'

const TEMPLATE = {
  COMPANY_NEWS: { label: 'The Client Observer', edition: 'Industry operations journal', size: 3, sections: ['Lead Report', 'In Focus', 'Operating Picture', 'Decision Desk'] },
  STAKEHOLDER_PROFILE: { label: 'Decision Context File', edition: 'Stakeholder research', size: 6, sections: ['Mandate and Role Context', 'Influence Environment', 'Decision Conditions', 'Items to Validate'] },
  FINANCIAL_SIGNAL: { label: 'Commercial Signal Note', edition: 'Financial research', size: 6, sections: ['Commercial Frame', 'Funding Conditions', 'Exposure and Measures', 'Validation Record'] },
  TECHNOLOGY_INDICATOR: { label: 'Technical Due Diligence', edition: 'Technology research', size: 6, sections: ['Current Landscape', 'Information Flows', 'Control Boundaries', 'Architecture Questions'] },
} as const

export const TRUST_LABEL = { HIGH: 'High trust', MEDIUM: 'Medium trust', LOW: 'Low trust' } as const

export interface SourceDocumentProps {
  source: ResearchArtifact
  index: number
  total: number
  savedBlockIds: Set<string>
  onSaveBlock: (block: ResearchSourceBlock) => void
  onSelection: (text: string, rect: DOMRect | null) => void
  onMove: (direction: -1 | 1) => void
}

export default function SourceDocument({ source, index, total, savedBlockIds, onSaveBlock, onSelection, onMove }: SourceDocumentProps) {
  const ref = useRef<HTMLElement>(null)
  const template = TEMPLATE[source.evidenceType as keyof typeof TEMPLATE] ?? TEMPLATE.COMPANY_NEWS
  const kind = source.evidenceType
  const facts = source.blocks.filter((block) => block.purpose === 'FACT')
  const words = facts.reduce((total, block) => total + block.content.split(/\s+/).length, 0)
  const minutes = Math.max(1, Math.ceil(words / 220))
  const sections = facts.reduce<ResearchSourceBlock[][]>((groups, block, position) => {
    if (position % template.size === 0) groups.push([])
    groups[groups.length - 1].push(block)
    return groups
  }, [])

  useEffect(() => {
    const onChange = () => {
      const selection = document.getSelection()
      const reader = ref.current
      if (!selection || selection.isCollapsed || !reader || selection.rangeCount === 0) return onSelection('', null)
      const range = selection.getRangeAt(0)
      if (!reader.contains(range.commonAncestorContainer)) return onSelection('', null)
      const blocks = Array.from(reader.querySelectorAll<HTMLElement>('[data-evidence-block="true"]')).filter((node) => range.intersectsNode(node))
      const text = selection.toString().replace(/\s+/g, ' ').trim()
      if (!blocks.length || text.length < 8) return onSelection('', null)
      onSelection(text, range.getBoundingClientRect())
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [onSelection])

  const renderBlock = (block: ResearchSourceBlock, first: boolean) => {
    const saved = savedBlockIds.has(block.id)
    const save = (
      <button
        type="button"
        className={`${styles.saveButton} ${saved ? styles.saveButtonSaved : ''}`}
        onClick={() => !saved && onSaveBlock(block)}
        aria-label={saved ? 'Already saved as evidence' : 'Save this passage as evidence'}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    )
    const data = { 'data-evidence-block': 'true' }
    if (block.type === 'QUOTE') {
      return (
        <div key={block.id} className={styles.row}>
          <blockquote className={styles.pullQuote} {...data}>
            {block.content}
            {block.attribution && <cite>— {block.attribution}</cite>}
          </blockquote>
          {save}
        </div>
      )
    }
    if (block.type === 'METRIC') {
      const [figure, ...rest] = block.content.split(' — ')
      return (
        <div key={block.id} className={styles.row}>
          <div className={styles.metric} {...data}>
            <strong>{figure}</strong>
            <span>{rest.join(' — ')}</span>
          </div>
          {save}
        </div>
      )
    }
    if (block.type === 'CAPTION') {
      return (
        <figure key={block.id} className={styles.photo}>
          <div className={styles.photoFrame} aria-hidden="true" />
          <figcaption {...data}>{block.content}</figcaption>
        </figure>
      )
    }
    return (
      <div key={block.id} className={styles.row}>
        <p className={`${styles.para} ${first && kind === 'COMPANY_NEWS' ? styles.dropCap : ''}`} {...data}>
          {block.content}
        </p>
        {save}
      </div>
    )
  }

  return (
    <article ref={ref} className={`${styles.document} ${styles[`doc_${kind}`] ?? ''}`}>
      {/* Pinned while reading: how to save evidence, and the way to the next source. */}
      <div className={styles.docNav}>
        <p className={styles.docHint}>
          <Bookmark size={16} aria-hidden="true" />
          <span>Press <b>Save</b> beside a passage, or highlight any part of it to save just that.</span>
        </p>
        <div className={styles.docPager}>
          <button type="button" onClick={() => onMove(-1)} disabled={total < 2} aria-label="Previous source"><ChevronLeft size={16} /></button>
          <span>Source {index + 1} of {total}</span>
          <button type="button" onClick={() => onMove(1)} disabled={total < 2} aria-label="Next source"><ChevronRight size={16} /></button>
        </div>
      </div>

      {kind === 'COMPANY_NEWS' ? (
        <>
          <header className={styles.masthead}>
            <div className={styles.mastheadTop}>
              <span>{template.edition}</span>
              <span>{source.publishedOn}</span>
            </div>
            <h2 className={styles.mastheadTitle}>{template.label}</h2>
            <nav className={styles.sectionBar} aria-hidden="true">
              <span>Business</span><span>Operations</span><span>Client watch</span><span>Research archive</span>
            </nav>
          </header>
          <header className={styles.newsHead}>
            <p className={styles.kicker}>
              <span className={`${styles.trust} ${styles[`trust_${source.confidence}`]}`}>{TRUST_LABEL[source.confidence]}</span>
              {source.sourceType}
            </p>
            <h1 className={styles.headline} data-evidence-block="true">{source.title}</h1>
            <p className={styles.dek} data-evidence-block="true">{source.summary}</p>
            <p className={styles.byline}>Operations desk · {source.origin.replace(/_/g, ' ').toLowerCase()} · {minutes} min read</p>
          </header>
        </>
      ) : (
        <header className={styles.fileHead}>
          <div className={styles.fileIdentity}>
            <span className={styles.fileEdition}>{template.edition}</span>
            <strong className={styles.fileLabel}>{template.label}</strong>
            <span className={styles.fileIssue}>Research issue · {source.publishedOn}</span>
          </div>
          {kind === 'STAKEHOLDER_PROFILE' && (
            <div className={styles.fileStrip}>
              <span className={styles.monogram} aria-hidden="true">{source.title.slice(0, 1)}</span>
              <div><span>Research focus</span><strong>Mandate, influence and decision conditions</strong></div>
              <span className={styles.fileStatus}>Open assessment</span>
            </div>
          )}
          {kind === 'FINANCIAL_SIGNAL' && (
            <div className={`${styles.banner} ${styles.bannerFinancial}`}><span>Analyst position</span><strong>Reported commercial signals are distinct from a confirmed investment decision.</strong></div>
          )}
          {kind === 'TECHNOLOGY_INDICATOR' && (
            <div className={`${styles.banner} ${styles.bannerTechnology}`}><span>Engineering position</span><strong>Document the current estate before inferring defects or target architecture.</strong></div>
          )}
          <p className={styles.kicker}>
            <span className={`${styles.trust} ${styles[`trust_${source.confidence}`]}`}>{TRUST_LABEL[source.confidence]}</span>
            {source.sourceType} · {source.origin.replace(/_/g, ' ').toLowerCase()}
          </p>
          <h1 className={styles.fileTitle} data-evidence-block="true">{source.title}</h1>
          <p className={styles.fileDek} data-evidence-block="true">{source.summary}</p>
        </header>
      )}

      <div className={styles.body}>
        {sections.map((section, sectionIndex) => (
          <section key={sectionIndex} className={styles.section}>
            <h3 className={styles.sectionHeading}>
              <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
              {template.sections[sectionIndex] ?? 'Research Record'}
            </h3>
            {section.map((block, position) => renderBlock(block, sectionIndex === 0 && position === 0))}
          </section>
        ))}
      </div>
    </article>
  )
}
