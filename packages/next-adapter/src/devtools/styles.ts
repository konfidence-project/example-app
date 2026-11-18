// Styles of the devtools widget. They live inside its shadow root, so nothing
// here reaches the app and no app style reaches the widget. The look is a dark
// tooling theme on purpose, in light and dark mode alike, so the widget never
// passes for a part of the app.
export const STYLES = `
:host {
  all: initial;
  --kd-bg: #0d1117;
  --kd-bg-raised: #161b22;
  --kd-bg-hover: #1f2630;
  --kd-line: #2b3340;
  --kd-text: #d6dde6;
  --kd-muted: #8b96a5;
  --kd-faint: #5d6877;
  --kd-brand: #f5a524;
  --kd-teal: #2dd4bf;
  --kd-green: #3fb950;
  --kd-green-bg: rgba(63, 185, 80, 0.14);
  --kd-red: #ff6b61;
  --kd-red-bg: rgba(255, 107, 97, 0.14);
  --kd-blue: #79b8ff;
  --kd-grey-bg: rgba(139, 150, 165, 0.16);
  --kd-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --kd-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; }

.fab {
  position: fixed;
  bottom: 16px;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #39424f;
  background: var(--kd-bg);
  color: var(--kd-brand);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.fab:hover { background: var(--kd-bg-hover); }
.fab:focus-visible, .panel button:focus-visible { outline: 2px solid var(--kd-teal); outline-offset: 2px; }
.right { right: 16px; }
.left { left: 16px; }

.panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  min-height: 160px;
  background: var(--kd-bg);
  color: var(--kd-text);
  font: 13px/1.45 var(--kd-sans);
  border-top: 1px solid #39424f;
  box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.35);
}
.resize {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  touch-action: none;
}
.resize::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 3px;
  width: 36px;
  height: 3px;
  margin-left: -18px;
  border-radius: 2px;
  background: #39424f;
}

.bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px;
  height: 40px;
  flex: none;
  border-bottom: 1px solid var(--kd-line);
  background: var(--kd-bg-raised);
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 600; white-space: nowrap; }
.brand svg { color: var(--kd-brand); }
.brand small { color: var(--kd-muted); font-weight: 400; }
.tabs { display: flex; gap: 2px; height: 100%; overflow-x: auto; }
.tab {
  height: 100%;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--kd-muted);
  cursor: pointer;
  white-space: nowrap;
}
.tab:hover { color: var(--kd-text); }
.tab[aria-selected="true"] { color: var(--kd-text); border-bottom-color: var(--kd-teal); }
.actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.meta { color: var(--kd-faint); font: 12px var(--kd-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 32ch; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--kd-line);
  border-radius: 6px;
  background: var(--kd-bg);
  color: var(--kd-text);
  cursor: pointer;
  font-size: 12px;
}
.btn:hover { background: var(--kd-bg-hover); }
.btn .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--kd-faint); }
.btn[aria-pressed="true"] .dot { background: var(--kd-green); box-shadow: 0 0 0 3px rgba(63, 185, 80, 0.2); }
.icon { width: 26px; padding: 0; justify-content: center; }

.body { flex: 1; overflow: auto; padding: 14px 16px 18px; }
.note { margin: 0 0 12px; color: var(--kd-muted); font-size: 12px; }
.note code, .mono { font-family: var(--kd-mono); font-size: 12px; }
.error { margin: 0 0 12px; padding: 8px 10px; border-radius: 6px; background: var(--kd-red-bg); color: var(--kd-red); font: 12px var(--kd-mono); }
h3 { margin: 18px 0 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--kd-muted); }
h3:first-child { margin-top: 0; }

.badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font: 11px/18px var(--kd-mono);
  background: var(--kd-grey-bg);
  color: var(--kd-muted);
  white-space: nowrap;
}
.badge.ok { background: var(--kd-green-bg); color: var(--kd-green); }
.badge.bad { background: var(--kd-red-bg); color: var(--kd-red); }
.badge.info { background: rgba(121, 184, 255, 0.14); color: var(--kd-blue); }

.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px 20px; margin: 0 0 4px; }
.facts div { min-width: 0; }
.facts dt { color: var(--kd-faint); font-size: 11px; }
.facts dd { margin: 2px 0 0; font: 12px var(--kd-mono); overflow-wrap: anywhere; }

.services { display: grid; gap: 8px; }
.service { border: 1px solid var(--kd-line); border-radius: 8px; padding: 10px 12px; background: var(--kd-bg-raised); }
.service-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.service-head strong { font-weight: 600; }
.service-head .sub { color: var(--kd-faint); font: 12px var(--kd-mono); }
.service-head .badge { margin-left: auto; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { display: inline-flex; gap: 8px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--kd-line); font: 12px var(--kd-mono); }
.chip.on { border-color: rgba(63, 185, 80, 0.45); color: var(--kd-green); }
.chip.differs { border-style: dashed; border-color: var(--kd-brand); }
.chip .v { color: var(--kd-muted); }
.chip.on .v { color: inherit; }
.urls { margin: 0; padding: 0; list-style: none; font: 12px/1.8 var(--kd-mono); }
.urls span { color: var(--kd-faint); }

table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--kd-faint); padding: 0 10px 6px; border-bottom: 1px solid var(--kd-line); }
td { padding: 7px 10px; border-bottom: 1px solid var(--kd-line); vertical-align: top; }
tr.implied td { color: var(--kd-muted); }
td .line2 { display: block; color: var(--kd-faint); font: 11px var(--kd-mono); max-width: 52ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
td .line2.err { color: var(--kd-red); white-space: normal; }
td.mono, td .mono { font-family: var(--kd-mono); }
.hop { white-space: nowrap; font-weight: 600; }
tr.implied .hop { font-weight: 400; }

.diagram { width: 100%; max-width: 980px; height: auto; display: block; }
.diagram .node rect { fill: var(--kd-bg-raised); stroke: #39424f; }
.diagram .node.self rect { stroke: var(--kd-brand); fill: rgba(245, 165, 36, 0.08); }
.diagram .node .t { fill: var(--kd-text); font: 600 14px var(--kd-sans); }
.diagram .node .s { fill: var(--kd-muted); font: 11px var(--kd-mono); }
.diagram .edge { fill: none; stroke: var(--kd-teal); stroke-opacity: 0.7; stroke-width: 1.6; }
.diagram .edge.idle { stroke: var(--kd-faint); stroke-dasharray: 4 4; }
.diagram .edge.fail { stroke: var(--kd-red); }
.diagram .pulse { fill: var(--kd-brand); }
.diagram .label { fill: var(--kd-muted); font: 11px var(--kd-mono); }
.diagram .zone { fill: var(--kd-faint); font: 600 10px var(--kd-sans); letter-spacing: 0.1em; }
.diagram .st-ok { fill: var(--kd-green); }
.diagram .st-bad { fill: var(--kd-red); }
.diagram .st-unknown { fill: var(--kd-faint); }

@media (max-width: 720px) {
  .meta, .brand small { display: none; }
  .bar { gap: 8px; }
}
@media (prefers-reduced-motion: no-preference) {
  .diagram .pulse { transition: opacity 0.3s; }
}
`;
