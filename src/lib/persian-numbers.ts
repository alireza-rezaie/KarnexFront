const latinDigits = /[0-9]/g
const persianDigits = '۰۱۲۳۴۵۶۷۸۹'

/** Formats a numeric value for user-facing Persian UI without changing its stored value. */
export function formatNumber(value: number | bigint, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('fa-IR', options).format(value)
}

/** Converts digits embedded in user-facing labels, dates, IDs and chart text. */
export function toPersianDigits(value: string | number | bigint) {
  return String(value).replace(latinDigits, (digit) => persianDigits[Number(digit)])
}

const ignoredTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'])
const localizedAttributes = ['aria-label', 'title', 'placeholder'] as const

function localizeElement(element: Element) {
  for (const attribute of localizedAttributes) {
    const value = element.getAttribute(attribute)
    if (value) element.setAttribute(attribute, toPersianDigits(value))
  }
}

function localizeTextNode(node: Text) {
  const parent = node.parentElement
  if (!parent || ignoredTags.has(parent.tagName)) return
  const localized = toPersianDigits(node.data)
  if (localized !== node.data) node.data = localized
}

function localizeTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text)
    return
  }

  if (root instanceof Element) {
    localizeElement(root)
    root.querySelectorAll('*').forEach(localizeElement)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    localizeTextNode(current as Text)
    current = walker.nextNode()
  }
}

/**
 * Keeps dynamically rendered React/Recharts text localized at the presentation
 * boundary. Form values, data, route IDs and application state are untouched.
 */
export function enableGlobalPersianDigits(root: HTMLElement) {
  localizeTree(root)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') localizeTextNode(mutation.target as Text)
      mutation.addedNodes.forEach(localizeTree)
    }
  })
  observer.observe(root, { childList: true, characterData: true, subtree: true })
  return () => observer.disconnect()
}
