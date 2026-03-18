import React, { useEffect, useState } from 'react';
import { getExecutions, getExecution } from '../api';

export default function AuditLog({ go, showToast }) {
  const [executions, setExecs] = useState([]);
  const [total, setTotal]      = useState(0);
  const [page, setPage]        = useState(1);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState('');
  const [viewing, setViewing]  = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getExecutions(page);
      setExecs(res.executions);
      setTotal(res.total);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const handleView = async (id) => {
    try {
      const data = await getExecution(id);
      setViewing(data);
    } catch (e) { setError(e.message); }
  };

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  const total_pages = Math.ceil(total / 20);

  const success = executions.filter(e => e.status === 'completed').length;
  const failed  = executions.filter(e => e.status === 'failed').length;

  if (loading) return <div className="loader"><div className="spinner" /> Loading...</div>;

  if (viewing) {
    const logs = Array.isArray(viewing.logs) ? viewing.logs : [];
    return (
      <div>
        <div className="back-btn" onClick={() => setViewing(null)}>← Back to Audit Log</div>
        <div className="page-header">
          <div>
            <div className="page-title">Execution Detail</div>
            <div className="page-sub">{viewing.workflow?.name} · {viewing.id.slice(0,16)}…</div>
          </div>
          <span className={`badge status-${viewing.status}`}>{viewing.status.toUpperCase()}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Status',   val: viewing.status },
            { label: 'Version',  val: `v${viewing.workflow_version}` },
            { label: 'Started',  val: fmt(viewing.started_at) },
            { label: 'Ended',    val: fmt(viewing.ended_at) },
          ].map(item => (
            <div className="stat-card" key={item.label}>
              <div className="stat-val" style={{ fontSize: 14 }}>{item.val}</div>
              <div className="stat-label">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="form-section" style={{ marginBottom: 12 }}>Input data</div>
        <div className="form-card" style={{ marginBottom: 20 }}>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', lineHeight: 1.6 }}>
            {JSON.stringify(viewing.data, null, 2)}
          </pre>
        </div>

        <div className="form-section" style={{ marginBottom: 12 }}>Step logs</div>
        {logs.map((log, i) => (
          <div className="exec-log-item" key={i}>
            <div className="exec-log-header">
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{i + 1}</span>
              <span className="exec-log-step-name">{log.step_name}</span>
              <span className={`badge ${log.step_type === 'approval' ? 'type-approval' : log.step_type === 'notification' ? 'type-notification' : 'type-task'}`}>{log.step_type}</span>
              <span className={`badge status-${log.status}`}>{log.status}</span>
            </div>
            {log.evaluated_rules?.map((r, j) => (
              <div className="exec-rule-row" key={j}>
                <span className={r.result ? 'exec-rule-pass' : 'exec-rule-fail'}>{r.result ? '✓' : '✗'}</span>
                <span style={{ color: 'var(--text3)' }}>P{r.priority}</span>
                <span className="exec-rule-text">{r.rule}</span>
              </div>
            ))}
            {log.selected_next_step && <div className="exec-next">→ {log.selected_next_step}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-sub">Complete history of all workflow executions</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-bar">
        <div className="stat-card"><div className="stat-val">{total}</div><div className="stat-label">Total runs</div></div>
        <div className="stat-card stat-green"><div className="stat-val">{success}</div><div className="stat-label">Completed</div></div>
        <div className="stat-card stat-red"><div className="stat-val">{failed}</div><div className="stat-label">Failed</div></div>
        <div className="stat-card stat-blue"><div className="stat-val">{total ? Math.round((success/total)*100) : 0}%</div><div className="stat-label">Success rate</div></div>
      </div>

      <div className="card">
        {executions.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◎</div>
            <h3>No executions yet</h3>
            <p>Execute a workflow to see logs here</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Execution ID</th>
                  <th>Workflow</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Started by</th>
                  <th>Start time</th>
                  <th>End time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {executions.map(ex => (
                  <tr key={ex.id}>
                    <td><span className="col-id mono">{ex.id.slice(0,8)}…</span></td>
                    <td><span className="col-name">{ex.workflow?.name || '—'}</span></td>
                    <td><span className="badge badge-blue">v{ex.workflow_version}</span></td>
                    <td><span className={`badge status-${ex.status}`}>{ex.status.toUpperCase()}</span></td>
                    <td><span className="col-mono">{ex.triggered_by}</span></td>
                    <td><span className="col-mono">{fmt(ex.started_at)}</span></td>
                    <td><span className="col-mono">{fmt(ex.ended_at)}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => handleView(ex.id)}>View Logs</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total_pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p-1)}>← Prev</button>
          <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{page} / {total_pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page === total_pages} onClick={() => setPage(p => p+1)}>Next →</button>
        </div>
      )}
    </div>
  );
}