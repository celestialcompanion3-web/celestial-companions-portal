import { useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { renderMarkdown, type Heading } from '../lib/markdown'
import { useTheme, type Theme } from '../lib/theme'

const palettes: Record<Theme, Record<string, string>> = {
  light: {
    darkMode: 'false',
    background: '#ffffff',
    primaryColor: '#eceffa',
    primaryTextColor: '#1a1e29',
    primaryBorderColor: '#3447a9',
    textColor: '#1a1e29',
    lineColor: '#5b6377',
    secondaryColor: '#eef0f6',
    tertiaryColor: '#f9fafc',
    clusterBkg: '#f5f6fb',
    clusterBorder: '#cdd1de',
    edgeLabelBackground: '#ffffff',
    actorBkg: '#eceffa',
    actorBorder: '#3447a9',
    actorTextColor: '#1a1e29',
    actorLineColor: '#9aa1b5',
    signalColor: '#5b6377',
    signalTextColor: '#1a1e29',
    labelBoxBkgColor: '#eceffa',
    labelBoxBorderColor: '#3447a9',
    labelTextColor: '#1a1e29',
    loopTextColor: '#1a1e29',
    noteBkgColor: '#eef0f6',
    noteTextColor: '#1a1e29',
    noteBorderColor: '#cdd1de',
    attributeBackgroundColorOdd: '#ffffff',
    attributeBackgroundColorEven: '#eef0f6',
  },
  dark: {
    darkMode: 'true',
    background: '#191c27',
    primaryColor: '#232a4a',
    primaryTextColor: '#e9ebf2',
    primaryBorderColor: '#8ea0f2',
    textColor: '#e9ebf2',
    lineColor: '#9aa1b5',
    secondaryColor: '#1e212b',
    tertiaryColor: '#14161d',
    clusterBkg: '#1e212b',
    clusterBorder: '#3a3f52',
    edgeLabelBackground: '#191c27',
    actorBkg: '#232a4a',
    actorBorder: '#8ea0f2',
    actorTextColor: '#e9ebf2',
    actorLineColor: '#6b7390',
    signalColor: '#9aa1b5',
    signalTextColor: '#e9ebf2',
    labelBoxBkgColor: '#232a4a',
    labelBoxBorderColor: '#8ea0f2',
    labelTextColor: '#e9ebf2',
    loopTextColor: '#e9ebf2',
    noteBkgColor: '#1e212b',
    noteTextColor: '#e9ebf2',
    noteBorderColor: '#3a3f52',
    attributeBackgroundColorOdd: '#191c27',
    attributeBackgroundColorEven: '#1e212b',
  },
}

let counter = 0

async function drawDiagrams(root: HTMLElement, theme: Theme, cancelled: () => boolean) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'))
  if (nodes.length === 0) return
  const { default: mermaid } = await import('mermaid')
  const vars: Record<string, string | boolean> = { ...palettes[theme], fontFamily: "'Archivo', system-ui, sans-serif", fontSize: '15px' }
  vars.darkMode = theme === 'dark'
  mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: vars, flowchart: { htmlLabels: true, curve: 'basis' } })
  for (const node of nodes) {
    if (cancelled()) return
    node.dataset.src ??= node.textContent ?? ''
    try {
      const { svg } = await mermaid.render(`diagram-${++counter}`, node.dataset.src)
      if (cancelled()) return
      node.innerHTML = svg
      node.setAttribute('data-processed', 'true')
      const drawn = node.querySelector('svg')
      if (drawn) {
        drawn.style.minWidth = '560px'
        drawn.style.maxWidth = 'none'
        drawn.style.height = 'auto'
      }
    } catch {
      node.textContent = 'This diagram could not be drawn.'
    }
  }
}

interface Props {
  source: string
  onHeadings?: (headings: Heading[]) => void
}

export function Markdown({ source, onHeadings }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const navigate = useNavigate()
  const { html, headings } = useMemo(() => renderMarkdown(source), [source])

  useEffect(() => {
    onHeadings?.(headings)
  }, [headings, onHeadings])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    let stop = false
    // Put the sources back first, so a theme change redraws from the text and not from the old drawing.
    root.querySelectorAll<HTMLElement>('pre.mermaid[data-src]').forEach((n) => {
      n.textContent = n.dataset.src ?? ''
      n.removeAttribute('data-processed')
    })
    void drawDiagrams(root, theme, () => stop)
    return () => {
      stop = true
    }
  }, [html, theme])

  // Links inside the text stay inside the app: "/questions" navigates, "#section" scrolls.
  function onClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest('a')
    const href = link?.getAttribute('href')
    if (!link || !href) return
    if (href.startsWith('/') && !href.startsWith('//')) {
      event.preventDefault()
      navigate(href)
    } else if (href.startsWith('#')) {
      event.preventDefault()
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return <div ref={ref} className="prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
