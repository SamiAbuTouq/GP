/**
 * Active nav pill radius: sidebar `NavButton`, Timetable Generation tabs, Dashboard tabs.
 * Sidebar reference: `components/sidebar.tsx` (`motion.div` + ghost `Button` wrapper).
 */
export const navActivePillRadiusClass = 'rounded-lg'

/** Alias for segmented tab triggers + motion pill (same radius as sidebar). */
export const segmentedNavTabItemRadiusClass = navActivePillRadiusClass

export const segmentedNavTabListClassName = `flex h-auto w-full flex-wrap items-stretch justify-start gap-1 ${segmentedNavTabItemRadiusClass} border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-900/50`
