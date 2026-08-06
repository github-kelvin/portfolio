// Returns [x, y] on `from`'s border facing `to` — the point an edge line
// leaves (or enters) a node.
export function anchor(from, to) {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [from.x + from.w, from.y + from.h / 2] : [from.x, from.y + from.h / 2];
  }
  return dy >= 0 ? [from.x + from.w / 2, from.y + from.h] : [from.x + from.w / 2, from.y];
}

// Minimal stroke-only diagram: squared boxes, hairline strokes, accent nodes
// outlined in the warm accent. Text styling comes from `.diagram text` CSS.
function FlowDiagram({ title, width, height, nodes, edges }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <svg className="flow-diagram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <defs>
        <marker id="fd-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="none" stroke="#9ba2c7" strokeWidth="1.2" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const [x1, y1] = anchor(byId[e.from], byId[e.to]);
        const [x2, y2] = anchor(byId[e.to], byId[e.from]);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ba2c7" strokeWidth="1.2" markerEnd="url(#fd-arrow)" />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            fill="none"
            stroke={n.accent ? 'rgba(242,145,17,0.4)' : 'rgba(255,255,255,0.15)'}
          />
          <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -2 : 4)} textAnchor="middle" fill="#f6f7fb">
            {n.label}
          </text>
          {n.sub && (
            <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 14} textAnchor="middle" fill="#9ba2c7">
              {n.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default FlowDiagram;
