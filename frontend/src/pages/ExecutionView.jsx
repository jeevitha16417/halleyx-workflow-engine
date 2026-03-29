import React, { useEffect, useState, useRef } from 'react';
import {
  getWorkflow, executeWorkflow, getExecution,
  cancelExecution, retryExecution,
  approveExecution, rejectExecution
} from '../api';

export default function ExecutionView({ go, workflowId, executionId: initExecId, showToast, user }) {  const [wf, setWf]           = useState(null);
  const [inputs, setInputs]   = useState({});
  const [execution, setExec]  = useState(null);
  const [execId, setExecId]   = useState(initExecId);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState('');
  const pollRef               = useRef(null);

  useEffect(() => {
    getWorkflow(workflowId)
      .then(data => {
        setWf(data);
        // pre-fill inputs from schema with default values
        const defaults = {};
        Object.entries(data.input_schema || {}).forEach(([k, v]) => {
          defaults[k] = v.type === 'number' ? 0 : '';
        });
        setInputs(defaults);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [workflowId]);

  // poll execution status every 1.5 seconds until done
  useEffect(() => {
    if (!execId) return;

    const poll = async () => {
      try {
        const data = await getExecution(execId);
        setExec(data);
        // stop polling when execution reaches a terminal state
        if (['completed', 'failed', 'canceled'].includes(data.status)) {
          clearInterval(pollRef.current);
          setRunning(false);
        }
      } catch (e) {
        clearInterval(pollRef.current);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [execId]);

  const handleRun = async () => {
    if (!wf.start_step_id) {
      setError('This workflow has no start step. Go to editor and add steps first.');
      return;
    }
    setRunning(true);
    setError('');
    setExec(null);
    try {
      const result = await executeWorkflow(workflowId, {
        data: inputs,
        triggered_by: 'user'
      });
      setExecId(result.id);
      showToast('Execution started!');
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelExecution(execId);
      showToast('Execution canceled');
    } catch (e) { setError(e.message); }
  };

  const handleRetry = async () => {
    setRunning(true);
    setError('');
    try {
      const result = await retryExecution(execId);
      setExecId(result.id);
      showToast('Retrying execution...');
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  const handleApprove = async () => {
    try {
      await approveExecution(execId, {
        approver_id: user?.username || "user", approver_role: user?.role || "manager",
        comment: 'Approved via UI'
      });
      showToast('Step approved — execution continues');
    } catch (e) { setError(e.message); }
  };

  const handleReject = async () => {
    try {
      await rejectExecution(execId, {
        approver_id: user?.username || "user", approver_role: user?.role || "manager",
        comment: 'Rejected via UI'
      });
      showToast('Step rejected');
    } catch (e) { setError(e.message); }
  };

  if (loading) return <div className="loader"><div className="spinner" /> Loading...</div>;

  const schemaFields = Object.entries(wf?.input_schema || {});
  const logs = Array.isArray(execution?.logs) ? execution.logs : [];

  // check if any step is currently waiting for approval
  const pendingApproval = logs.find(l => l.status === 'pending_approval');

  return (
    <div>
      <div className="back-btn" onClick={() => go('list')}>← Back to Workflows</div>

      <div className="page-header">
        <div>
          <div className="page-title">Execute: {wf?.name}</div>
          <div className="page-sub">v{wf?.version} — fill in the input data and run</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Input form ── */}
        <div className="form-card">
          <div className="form-section">Input data</div>

          {schemaFields.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              No input schema defined
            </div>
          ) : (
            schemaFields.map(([field, meta]) => (
              <div className="form-row" key={field}>
                <label className="form-label">
                  {field}
                  {meta.required && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
                  <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>
                    ({meta.type})
                  </span>
                </label>

                {meta.allowed_values?.length > 0 ? (
                  <select
                    className="form-select"
                    value={inputs[field] || ''}
                    onChange={e => setInputs(p => ({ ...p, [field]: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    {meta.allowed_values.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    type={meta.type === 'number' ? 'number' : 'text'}
                    placeholder={field}
                    value={inputs[field] ?? ''}
                    onChange={e => setInputs(p => ({
                      ...p,
                      [field]: meta.type === 'number'
                        ? parseFloat(e.target.value) || 0
                        : e.target.value
                    }))}
                  />
                )}
              </div>
            ))
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={running || (execution && ['pending', 'in_progress'].includes(execution.status))}
            >
              {running ? '⏳ Running...' : '▶ Start Execution'}
            </button>

            {execution && ['pending', 'in_progress'].includes(execution.status) && (
              <button className="btn btn-danger btn-sm" onClick={handleCancel}>
                Cancel
              </button>
            )}

            {execution?.status === 'failed' && (
              <button className="btn btn-blue btn-sm" onClick={handleRetry}>
                ↺ Retry
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Execution results ── */}
        <div>
          {!execution ? (
            <div className="card">
              <div style={{
                padding: '48px 0', textAlign: 'center',
                fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)'
              }}>
                Fill in the inputs and click Start Execution
              </div>
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="form-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Status</div>
                    <span className={`badge status-${execution.status}`}>
                      {execution.status === 'in_progress' && pendingApproval
                        ? 'WAITING APPROVAL'
                        : execution.status.toUpperCase()
                      }
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Execution ID</div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                      {execution.id.slice(0, 16)}…
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Started</div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                      {new Date(execution.started_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {execution.retries > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Retries</div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)' }}>
                        {execution.retries}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step logs */}
              <div className="form-section" style={{ marginBottom: 12 }}>
                Step execution log
              </div>

              {logs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  {['pending', 'in_progress'].includes(execution.status)
                    ? '⏳ Executing...'
                    : 'No logs recorded'
                  }
                </div>
              ) : (
                logs.map((log, i) => (
                  <div className="exec-log-item" key={i}>

                    {/* Step header */}
                    <div className="exec-log-header">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                        {i + 1}
                      </span>
                      <span className="exec-log-step-name">{log.step_name}</span>
                      <span className={
                        log.step_type === 'approval'     ? 'type-approval' :
                        log.step_type === 'notification' ? 'type-notification' :
                        'type-task'
                      }>
                        {log.step_type}
                      </span>
                      <span className={`badge status-${
                        log.status === 'pending_approval' ? 'pending' : log.status
                      }`}>
                        {log.status === 'pending_approval' ? 'WAITING APPROVAL' : log.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Approve / Reject buttons for pending approval */}
                    {log.status === 'pending_approval' &&
 execution?.status === 'in_progress' &&
 user && user.role !== 'admin' && user.role !== 'finance' &&
 user.role === (log.assignee_role || 'manager') && (
                      <div style={{
                        background: 'var(--bg4)',
                        border: '1px solid var(--border2)',
                        borderRadius: 'var(--r2)',
                        padding: '12px 14px',
                        marginBottom: 10
                      }}>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                          This step requires manual approval. Review the submitted data and decide:
                        </div>
                        <div style={{
                          background: 'var(--bg3)', borderRadius: 'var(--r2)',
                          padding: '8px 10px', marginBottom: 10,
                          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)'
                        }}>
                          {JSON.stringify(inputs, null, 2)}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={handleApprove}>
                            ✓ Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={handleReject}>
                            ✗ Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approval result */}
                    {(log.status === 'approved' || log.status === 'rejected') && (
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--mono)',
                        color: log.status === 'approved' ? 'var(--accent)' : 'var(--danger)',
                        marginBottom: 8
                      }}>
                        {log.status === 'approved' ? '✓' : '✗'} {log.status.toUpperCase()} by {log.approver_id}
                        {log.comment && ` — "${log.comment}"`}
                      </div>
                    )}

                    {/* Notification result */}
                    {log.notification_sent && (
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--mono)',
                        color: 'var(--blue)', marginBottom: 8,
                        background: 'var(--bg3)', borderRadius: 'var(--r2)',
                        padding: '6px 10px'
                      }}>
                        ✉ Sent via {log.notification_sent.channel} to {log.notification_sent.recipient}
                        {log.notification_sent.simulated && (
                          <span style={{ color: 'var(--text3)', marginLeft: 6 }}>(simulated)</span>
                        )}
                      </div>
                    )}

                    {/* Rules evaluated */}
                    {log.evaluated_rules?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{
                          fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)',
                          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6
                        }}>
                          Rules evaluated
                        </div>
                        {log.evaluated_rules.map((r, j) => (
                          <div className="exec-rule-row" key={j}>
                            <span className={r.result ? 'exec-rule-pass' : 'exec-rule-fail'}>
                              {r.result ? '✓' : '✗'}
                            </span>
                            <span style={{ color: 'var(--text3)' }}>P{r.priority}</span>
                            <span className="exec-rule-text">{r.rule}</span>
                            {r.error && (
                              <span style={{ color: 'var(--danger)', fontSize: 10 }}>
                                ⚠ {r.error}
                              </span>
                            )}
                            <span style={{ color: r.result ? 'var(--accent)' : 'var(--text3)' }}>
                              {r.result ? 'MATCH' : 'no match'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Next step */}
                    {log.selected_next_step && (
                      <div className="exec-next">→ Next: {log.selected_next_step}</div>
                    )}

                    {/* Error message */}
                    {log.error_message && (
                      <div style={{
                        fontSize: 11, color: 'var(--danger)',
                        fontFamily: 'var(--mono)', marginTop: 6
                      }}>
                        ✗ {log.error_message}
                      </div>
                    )}

                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}