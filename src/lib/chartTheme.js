/**
 * Global Recharts theme — apply to every chart in the system.
 * All values here are tuned for the dark zinc palette.
 */

/* ── Tooltip ────────────────────────────────────────────────── */
export const TOOLTIP_STYLE = {
    contentStyle: {
        background: '#18181b',        // zinc-900
        border: '1px solid #3f3f46', // zinc-700
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        fontSize: 13,
        color: '#fafafa',            // zinc-50
    },
    labelStyle: {
        color: '#71717a',             // zinc-500
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 4,
        fontWeight: 600,
    },
    itemStyle: {
        color: '#fafafa',
        fontWeight: 600,
    },
    cursor: { fill: 'rgba(255,255,255,0.04)' },
};

/* ── Grid ───────────────────────────────────────────────────── */
export const GRID_PROPS = {
    strokeDasharray: '3 3',
    stroke: '#27272a',     // zinc-800
    strokeOpacity: 0.6,
    vertical: false,
};

/* ── Axes ───────────────────────────────────────────────────── */
export const AXIS_TICK = { fill: '#71717a', fontSize: 11 }; // zinc-500
export const AXIS_SHARED = { axisLine: false, tickLine: false };

/* ── Animations ─────────────────────────────────────────────── */
export const ANIMATION = {
    isAnimationActive: true,
    animationDuration: 600,
    animationEasing: 'ease-out',
};

/* ── Bar style helpers ──────────────────────────────────────── */
export const barRadius = [6, 6, 0, 0];        // top corners
export const barRadiusH = [0, 4, 4, 0];       // horizontal (right corners)
export const BAR_BG = { fill: '#18181b', radius: [6, 6, 0, 0] };
export const MAX_BAR_SIZE = 48;
