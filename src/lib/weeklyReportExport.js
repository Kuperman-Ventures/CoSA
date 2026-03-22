/**
 * Weekly Review → HTML export (print-to-PDF ready)
 *
 * Called from App.jsx with all the data already computed for the Weekly Review screen.
 * Opens the report in a new window; the user can Ctrl/Cmd-P → Save as PDF.
 */

function fmt(mins) {
  if (!mins || mins < 1) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function scoreMeta(weekScore) {
  return {
    green:  { label: 'Green',  color: '#166534', bg: '#dcfce7', border: '#86efac', emoji: '🟢' },
    yellow: { label: 'Yellow', color: '#854d0e', bg: '#fef9c3', border: '#fde047', emoji: '🟡' },
    red:    { label: 'Red',    color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', emoji: '🔴' },
  }[weekScore] ?? { label: 'Unknown', color: '#334155', bg: '#f1f5f9', border: '#cbd5e1', emoji: '⬜' }
}

/**
 * @param {object} opts
 * @param {Date}   opts.weekStart
 * @param {Date}   opts.weekEnd
 * @param {object} opts.kpiSummary         { kpisHit, kpisTotal, weekScore, kpiResults }
 * @param {string[]} opts.kpiTrackGroups
 * @param {object[]} opts.timeByTrack      from renderKpiDashboard
 * @param {object[]} opts.completionLog    full filtered week entries (already merged)
 */
export function exportWeeklyReportHTML({ weekStart, weekEnd, kpiSummary, kpiTrackGroups, timeByTrack, completionLog }) {
  const { kpisHit, kpisTotal, weekScore, kpiResults } = kpiSummary
  const sm = scoreMeta(weekScore)

  const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' + weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // ── KPI scorecard tables ────────────────────────────────────────────────────
  function kpiGroupTable(group) {
    const rows = kpiResults.filter((k) => k.trackGroup === group)
    if (rows.length === 0) return ''
    const accentColor = rows[0]?.color ?? '#64748b'
    const rowsHtml = rows.map((kpi) => {
      const hit = kpi.hit
      const statusBg = kpi.isRate && kpi.total === 0 ? '#f1f5f9' : hit ? '#dcfce7' : '#fee2e2'
      const statusColor = kpi.isRate && kpi.total === 0 ? '#94a3b8' : hit ? '#166534' : '#991b1b'
      const statusText = kpi.isRate && kpi.total === 0 ? 'No sessions'
        : kpi.isRate ? `${kpi.count}/${kpi.total}`
        : hit ? '✓ Hit' : '✗ Miss'
      const countDisplay = kpi.isRate
        ? (kpi.total > 0 ? `${kpi.count} / ${kpi.total}` : '—')
        : String(kpi.count)
      const targetDisplay = kpi.isRate
        ? 'Every session'
        : kpi.target ? `${kpi.target}/${kpi.period === 'month' ? 'mo' : 'wk'}` : '—'
      return `
        <tr>
          <td style="padding:7px 12px;color:#334155">${kpi.label}</td>
          <td style="padding:7px 12px;text-align:center;color:#64748b">${targetDisplay}</td>
          <td style="padding:7px 12px;text-align:center;font-weight:600;color:#0f172a">${countDisplay}</td>
          <td style="padding:7px 12px;text-align:center">
            <span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">${statusText}</span>
          </td>
        </tr>`
    }).join('')
    return `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header" style="background:${accentColor}18;border-bottom:1px solid ${accentColor}30">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${accentColor};margin-right:8px"></span>
          <strong style="font-size:13px;color:#0f172a">${group}</strong>
        </div>
        <table class="kpi-table">
          <thead>
            <tr>
              <th style="text-align:left">KPI</th>
              <th style="text-align:center">Target</th>
              <th style="text-align:center">This Week</th>
              <th style="text-align:center">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`
  }

  // ── Time by track ───────────────────────────────────────────────────────────
  function trackBar(trackData) {
    const { track, minutesLogged, targetMins, pct, calendarMins, subTrackRows } = trackData
    const barColor = track.color
    const minutesFromTimer = minutesLogged - calendarMins
    const subHtml = subTrackRows.length > 0
      ? `<div style="margin-top:6px;padding-left:4px;border-left:3px solid ${barColor}30">` +
        subTrackRows.map(([st, m]) =>
          `<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:1px 0">
            <span>${st}</span><span style="font-weight:600">${fmt(m)}</span>
          </div>`
        ).join('') +
        `</div>`
      : ''
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600;color:#0f172a">${track.label}</span>
          <span style="color:${pct >= 100 ? '#166534' : pct >= 60 ? '#854d0e' : '#64748b'}">
            <strong>${fmt(minutesLogged)}</strong> <span style="color:#94a3b8">/ ${fmt(targetMins)}</span>
          </span>
        </div>
        <div style="height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100, pct)}%;background:${barColor};border-radius:99px"></div>
        </div>
        ${calendarMins > 0 ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">Calendar: <strong style="color:#64748b">${fmt(calendarMins)}</strong> · Timer: <strong style="color:#64748b">${fmt(minutesFromTimer)}</strong></div>` : ''}
        ${subHtml}
      </div>`
  }

  // ── Work log — entries grouped by track ─────────────────────────────────────
  function workLog() {
    // Combine timer/quicklog entries + calendar entries from all tracks
    const allEntries = []
    for (const td of timeByTrack) {
      for (const e of td.entries ?? []) {
        allEntries.push({ ...e, _trackLabel: td.track.label, _trackColor: td.track.color })
      }
      for (const e of td.calendarEntries ?? []) {
        allEntries.push({ ...e, _trackLabel: td.track.label, _trackColor: td.track.color })
      }
    }
    // Also add completionLog entries that don't already appear (networking track etc.)
    const seenIds = new Set(allEntries.map((e) => e.id))
    for (const e of completionLog) {
      if (!seenIds.has(e.id)) {
        allEntries.push({ ...e, _trackLabel: e.track ?? '', _trackColor: '#64748b' })
      }
    }

    // Group by track label
    const byTrack = {}
    for (const e of allEntries) {
      const tl = e._trackLabel || e.track || 'Other'
      if (!byTrack[tl]) byTrack[tl] = []
      byTrack[tl].push(e)
    }

    if (Object.keys(byTrack).length === 0) {
      return '<p style="color:#94a3b8;font-style:italic;font-size:13px">No sessions logged this week.</p>'
    }

    return Object.entries(byTrack).map(([trackLabel, entries]) => {
      const trackColor = entries[0]?._trackColor ?? '#64748b'
      const sorted = [...entries].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
      const rowsHtml = sorted.map((e) => {
        const mins = Math.round((e.elapsedSeconds ?? 0) / 60)
        const sourceColor = e._fromCalendar ? '#6d28d9' : e.isQuickLog ? '#b45309' : '#0369a1'
        const sourceBg   = e._fromCalendar ? '#ede9fe'  : e.isQuickLog ? '#fef3c7'  : '#e0f2fe'
        const sourceText = e._fromCalendar
          ? (e._calendarSource === 'personal-tagged' ? 'Tagged event' : 'CoSA event')
          : e.isQuickLog ? 'Quick log' : 'Timer'
        return `
          <tr>
            <td style="padding:6px 10px;color:#0f172a;max-width:260px;word-break:break-word">${e.taskName ?? '—'}</td>
            <td style="padding:6px 10px;color:#64748b;white-space:nowrap">${fmtDate(e.completedAt)}</td>
            <td style="padding:6px 10px;color:#64748b;white-space:nowrap">${fmtTime(e.completedAt)}</td>
            <td style="padding:6px 10px;text-align:center;white-space:nowrap">
              <span style="background:${sourceBg};color:${sourceColor};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${sourceText}</span>
            </td>
            <td style="padding:6px 10px;text-align:right;font-weight:600;color:#334155;white-space:nowrap">${mins > 0 ? `${mins}m` : '—'}</td>
            <td style="padding:6px 10px;color:#94a3b8;font-size:11px">${e.kpiMapping || (e._fromCalendar ? 'Time only' : '—')}</td>
          </tr>`
      }).join('')

      const totalMins = sorted.reduce((s, e) => s + Math.round((e.elapsedSeconds ?? 0) / 60), 0)
      return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header" style="background:${trackColor}18;border-bottom:1px solid ${trackColor}30;display:flex;justify-content:space-between;align-items:center">
            <span>
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${trackColor};margin-right:8px"></span>
              <strong style="font-size:13px;color:#0f172a">${trackLabel}</strong>
            </span>
            <span style="font-size:12px;color:#64748b">${sorted.length} entries · <strong>${fmt(totalMins)}</strong></span>
          </div>
          <table class="log-table">
            <thead>
              <tr>
                <th>Task / Event</th>
                <th>Date</th>
                <th>Time</th>
                <th style="text-align:center">Source</th>
                <th style="text-align:right">Duration</th>
                <th>KPI credit</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`
    }).join('')
  }

  // ── Assemble HTML ──────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>CoSA Weekly Review — ${weekLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
      padding: 32px;
      max-width: 960px;
      margin: 0 auto;
    }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
    h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 700;
      border: 1.5px solid ${sm.border};
      background: ${sm.bg};
      color: ${sm.color};
    }
    .score-block {
      background: ${sm.bg};
      border: 1.5px solid ${sm.border};
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .score-block .score-label { font-size: 24px; font-weight: 800; color: ${sm.color}; }
    .score-block .score-sub   { font-size: 12px; color: ${sm.color}; opacity: .8; margin-top: 2px; }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    .card-header { padding: 8px 14px; }
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #f1f5f9;
    }
    .kpi-table, .log-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .kpi-table thead tr, .log-table thead tr {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .kpi-table th, .log-table th {
      padding: 7px 12px;
      font-weight: 600;
      color: #64748b;
      font-size: 11px;
      text-align: left;
    }
    .kpi-table tbody tr:not(:last-child),
    .log-table tbody tr:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
      .card { break-inside: avoid; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:20px">
    <button onclick="window.print()" style="
      background:#0f172a;color:#fff;border:none;border-radius:8px;
      padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer
    ">🖨 Print / Save as PDF</button>
  </div>

  <!-- Header -->
  <div style="margin-bottom:20px">
    <p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px">CoSA · Weekly Review</p>
    <h1>${weekLabel}</h1>
  </div>

  <!-- Week Score -->
  <div class="score-block">
    <div class="score-label">${sm.emoji} ${sm.label} Week</div>
    <div class="score-sub">${kpisHit} of ${kpisTotal} KPIs hit this week</div>
  </div>

  <!-- KPI Scorecards -->
  <div class="section">
    <div class="section-title">KPI Scorecards</div>
    ${kpiTrackGroups.map(kpiGroupTable).join('')}
  </div>

  <!-- Time by Track -->
  <div class="section">
    <div class="section-title">Time Logged This Week</div>
    <div class="card" style="padding:16px 20px">
      ${timeByTrack.map(trackBar).join('')}
    </div>
  </div>

  <!-- Work Log -->
  <div class="section">
    <div class="section-title">Work Log — Tasks &amp; Events</div>
    ${workLog()}
  </div>

  <div class="footer">
    <span>CoSA — Command of Strategic Action</span>
    <span>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site to export the report.')
    return
  }
  win.document.write(html)
  win.document.close()
}
