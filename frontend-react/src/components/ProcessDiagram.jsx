import { useEffect, useRef, useState } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import { api } from '../api/client';

/**
 * Draws a deployed BPMN model fetched from the backend (exam cell only).
 *  - elements: element instances of one request; colours each element by state:
 *    completed (green), active (blue), incident (red).
 *  - counts: per-element statistics of the whole process; shows how many requests are at each step.
 * Both are refreshed on every poll without reloading the diagram.
 */
export default function ProcessDiagram({ url, elements, counts, height = 380 }) {
  const container = useRef(null);
  const viewer = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    const v = new NavigatedViewer({ container: container.current });
    viewer.current = v;
    (async () => {
      try {
        await v.importXML(await api(url));
        if (cancelled) return;
        v.get('canvas').zoom('fit-viewport');
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Diagram not available yet');
      }
    })();
    return () => {
      cancelled = true;
      v.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!ready || !viewer.current) return;
    const canvas = viewer.current.get('canvas');
    const registry = viewer.current.get('elementRegistry');
    registry.getAll().forEach((el) => ['el-done', 'el-active', 'el-incident'].forEach((m) => canvas.removeMarker(el.id, m)));
    // Latest state per element wins; a multi-instance task is active while any subject is still open.
    const latest = {};
    (elements || []).forEach((e) => {
      latest[e.elementId] = e.incident ? 'el-incident' : e.state === 'ACTIVE' ? (latest[e.elementId] === 'el-incident' ? 'el-incident' : 'el-active')
        : e.state === 'COMPLETED' ? (latest[e.elementId] || 'el-done') : latest[e.elementId];
    });
    Object.entries(latest).forEach(([id, m]) => m && registry.get(id) && canvas.addMarker(id, m));
  }, [ready, elements]);

  useEffect(() => {
    if (!ready || !viewer.current) return;
    const overlays = viewer.current.get('overlays');
    const registry = viewer.current.get('elementRegistry');
    overlays.remove({ type: 'instance-count' });
    (counts || []).forEach((c) => {
      if (!registry.get(c.elementId) || (!c.active && !c.incidents)) return;
      const html = document.createElement('div');
      html.className = 'flex gap-1';
      if (c.active) html.appendChild(badge(c.active, '#0b5394', `${c.active} active`));
      if (c.incidents) html.appendChild(badge(c.incidents, '#b42318', `${c.incidents} with an incident`));
      overlays.add(c.elementId, 'instance-count', { position: { bottom: 10, left: -8 }, html });
    });
  }, [ready, counts]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-lg border border-line bg-white">
        <div ref={container} style={{ height }} className="w-full" aria-label="Process diagram" role="img" />
        {error && <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-muted-foreground">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-3 text-[12.5px] text-foreground/80">
        {elements && (
          <>
            <Legend cls="border-ok">Done</Legend>
            <Legend cls="border-brand bg-brand-soft">Active</Legend>
            <Legend cls="border-pen bg-pen-soft">Needs attention</Legend>
          </>
        )}
        {counts && (
          <>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-brand" />Requests waiting at this step</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-pen" />Incidents</span>
          </>
        )}
        <span className="text-muted-foreground">Scroll to zoom, drag to move.</span>
      </div>
      <style>{`
        .el-done:not(.djs-connection) .djs-visual > :nth-child(1) { stroke: #11734a !important; }
        .el-active:not(.djs-connection) .djs-visual > :nth-child(1) { stroke: #0b5394 !important; fill: #e7f0f9 !important; stroke-width: 3px !important; }
        .el-incident:not(.djs-connection) .djs-visual > :nth-child(1) { stroke: #b42318 !important; fill: #fdecea !important; stroke-width: 3px !important; }
      `}</style>
    </div>
  );
}

function badge(n, color, label) {
  const b = document.createElement('span');
  b.textContent = String(n);
  b.title = label;
  b.setAttribute('aria-label', label);
  b.style.cssText = `background:${color};color:#fff;border-radius:999px;min-width:22px;height:22px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;font:600 12px/1 "IBM Plex Mono",monospace;box-shadow:0 0 0 2px #fff`;
  return b;
}

function Legend({ cls, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-3 w-3 rounded-[3px] border-2 ${cls}`} />
      {children}
    </span>
  );
}
