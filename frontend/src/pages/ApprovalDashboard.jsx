import React, { useEffect, useState } from 'react';
import { getPendingApprovals, approveExecution, rejectExecution } from '../api';

export default function ApprovalDashboard({ user, showToast }) {
  const [pending, setPending]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      // fetch only approvals for THIS user's role
      const data = await getPendingApprovals(user.role);
      setPending(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (execId) => {
    try {
      await approveExecution(execId, {
        approver_id:   user.name,
        approver_role: user.role,
        comment:       'Approved by ' + user.name
      });
      showToast('Approved successfully');
      load();
    } catch (e) { setError(e.message); }
  };

  const handleReject = async (execId) => {
    const comment = window.prompt('Reason for rejection (optional):') || 'Rejected by ' + user.name;
    try {
      await rejectExecution(execId, {
        approver_id:   user.name,
        approver_role: user.role,
        comment
      });
      showToast('Step rejected');
      load();
    } catch (e) { setError(e.message); }
  };

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const fmt = (d) => new Date(d).toLocaleString('en-IN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  if (loading) return <div className="loader"><div className="spinner" /> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My Pending Approvals</div>
          <div className="page-sub">
            Logged in as <strong style={{ color: 'var(--accent)' }}>{user.name}</strong>
            &nbsp;·&nbsp; Role: <strong style={{ textTransform: 'capitalize' }}>{user.role}</strong>
            &nbsp;·&nbsp; Showing only steps assigned to you
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {pending.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">✓</div>
          <h3>No pending approvals</h3>
          <p>Nothing assigned to you right now. Check back later.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map(ex => {
            const logs       = Array.isArray(ex.logs) ? ex.logs : [];
            const pendingLog = logs.find(l => l.status === 'pending_approval');
            const isOpen     = expanded[ex.id];

            return (
              <div key={ex.id} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {ex.workflow?.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                      Started {fmt(ex.started_at)} &nbsp;·&nbsp;
                      ID: <span style={{ fontFamily: 'var(--mono)' }}>{ex.id.slice(0, 8)}…</span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 500,
                    padding: '3px 8px', borderRadius: 4,
                    background: '#2d2008', color: '#d29922',
                    border: '1px solid #5a3c00', textTransform: 'uppercase'
                  }}>
                    Waiting for {user.role}
                  </span>
                </div>

                {pendingLog && (
                  <div style={{
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    borderRadius: 7, padding: '12px 14px', marginBottom: 14
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                      STEP REQUIRING YOUR APPROVAL
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {pendingLog.step_name}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggle(ex.id)} style={{
                    background: 'none', border: 'none', color: 'var(--text2)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--mono)', padding: 0
                  }}>
                    {isOpen ? '▲' : '▼'} View submitted data
                  </button>
                  {isOpen && (
                    <div style={{
                      background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px',
                      marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12,
                      color: 'var(--accent)', lineHeight: 1.7
                    }}>
                      {Object.entries(ex.data || {}).map(([k, v]) => (
                        <div key={k}>
                          <span style={{ color: 'var(--text3)' }}>{k}:</span> {String(v)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(ex.id)}>
                    ✓ Approve
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleReject(ex.id)}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}