import React from 'react'

import React, { memo } from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─── Icons ────────────────────────────────────────────────────────────────────
// Lightweight SVG icon factory — no external dependency
const I = ({ d, size = 22, color = 'currentColor', sw = 1.8, fill = 'none' }) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

export const IPlus     = p => <I {...p} d="M12 5v14M5 12h14" />
export const ITrash    = p => <I color="var(--red)" {...p} d={['M3 6h18','M19 6l-1 14H6L5 6','M8 6V4h8v2']} />
export const ICircle   = p => <I {...p} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20" />
export const ICheck    = p => <I {...p} d={['M22 11.08V12a10 10 0 1 1-5.93-9.14','M22 4 12 14.01l-3-3']} />
export const IChevR    = p => <I {...p} d="M9 18l6-6-6-6" />
export const IChevL    = p => <I {...p} d="M15 18l-6-6 6-6" />
export const IEdit     = p => <I color="var(--accent)" {...p} d={['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7','M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z']} />
export const ICal      = p => <I {...p} d={['M8 2v4','M16 2v4','M3 10h18','M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} />
export const ICamera   = p => <I {...p} d={['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']} />
export const IUpload   = p => <I {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M17 8l-5-5-5 5','M12 3v12']} />
export const IClose    = p => <I {...p} d="M18 6 6 18M6 6l12 12" />
export const ILink     = p => <I {...p} d={['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71','M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']} />
export const IGrid     = p => <I {...p} d={['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z']} />
export const IFolder   = p => <I {...p} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
export const ICart     = p => <I {...p} d={['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z','M3 6h18','M16 10a4 4 0 0 1-8 0']} />
export const IWrench   = p => <I {...p} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
export const ITree     = p => <I {...p} d={['M17 14l3-3-3-3','M7 10l-3 3 3 3','M11 5l-2 14','M13 5l2 14']} />
export const IBulb     = p => <I {...p} d={['M9 18h6','M10 22h4','M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z']} />
export const IBook     = p => <I {...p} d={['M4 19.5A2.5 2.5 0 0 1 6.5 17H20','M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z']} />
export const IHouse    = p => <I {...p} d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M9 22V12h6v10']} />
export const IImage    = p => <I {...p} d={['M21 15l-5-5L5 21','M3 3h18v18H3z','M8.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z']} />
export const ILayers   = p => <I {...p} d={['M12 2L2 7l10 5 10-5-10-5','M2 17l10 5 10-5','M2 12l10 5 10-5']} />
export const IMore     = p => <I {...p} d="M5 12h.01M12 12h.01M19 12h.01" sw={3} />
export const IBell     = p => <I {...p} d={['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 0 1-3.46 0']} />
export const ISearch   = p => <I {...p} d={['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.35-4.35']} />
export const ISaw      = p => <I {...p} d={['M3 9h13l4 3-4 3H3V9z','M7 9v6','M10 9v6','M13 9v6','M1 12h2']} />
export const ICalc     = ({ size = 24, color = 'currentColor', sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {/* + top-left */}
    <line x1="4" y1="6" x2="8" y2="6"/><line x1="6" y1="4" x2="6" y2="8"/>
    {/* - top-right */}
    <line x1="16" y1="6" x2="20" y2="6"/>
    {/* × bottom-left */}
    <line x1="4" y1="16" x2="8" y2="20"/><line x1="8" y1="16" x2="4" y2="20"/>
    {/* ÷ bottom-right */}
    <line x1="16" y1="18" x2="20" y2="18"/>
    <circle cx="18" cy="15" r="0.8" fill={color} stroke="none"/>
    <circle cx="18" cy="21" r="0.8" fill={color} stroke="none"/>
  </svg>
)
export const IDollar   = p => <I {...p} d={['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']} />
export const IBrain    = p => <I {...p} d={['M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.84A2.5 2.5 0 0 1 9.5 2','M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.84A2.5 2.5 0 0 0 14.5 2']} />
export const IIdea    = p => <I {...p} d={['M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z','M9 21h6','M9.5 17.5h5']} />
export const IStar     = p => <I {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={p.fill||'none'} />
export const IZap      = p => <I {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
export const IParty    = p => <I {...p} d={['M5.8 11.3L2 22l10.7-3.8','M4 3h.01','M22 8h.01','M15 2h.01','M22 20h.01','M22 2l-2.2 7.4A2 2 0 0 1 17.9 11H15l-2 6-4-8 6-2h2.9a2 2 0 0 1 1.9 1.4L22 2z']} />
export const IList     = p => <I {...p} d={['M8 6h13','M8 12h13','M8 18h13','M3 6h.01','M3 12h.01','M3 18h.01']} />
export const IPalette  = p => <I {...p} d={['M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.41-1.42-1.42 1.42 1.41 1.41-6.6 6.6A2 2 0 0 0 5 15.41V19h3.59c.53 0 1.04-.21 1.41-.59l6.6-6.6 1.41 1.41 1.42-1.42-1.41-1.41 3.12-3.12a1 1 0 0 0-.83-1.05z']} />
export const ITrophy   = p => <I {...p} d={['M6 9H4.5a2.5 2.5 0 0 1 0-5H6','M18 9h1.5a2.5 2.5 0 0 0 0-5H18','M4 22h16','M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22','M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22','M18 2H6v7a6 6 0 0 0 12 0V2z']} />
export const IDrop     = p => <I {...p} d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
export const IAlert    = p => <I {...p} d={['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z','M12 9v4','M12 17h.01']} />
