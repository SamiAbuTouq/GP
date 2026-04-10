import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Title-case words for display (e.g. course analytics charts). */
export function formatName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .split(' ')
    .filter((word) => word)
    .map((word) => {
      if (word.startsWith('(') || word.match(/^\d/)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
