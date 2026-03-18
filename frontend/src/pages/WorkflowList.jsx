import React, { useEffect, useState } from 'react';
import { getWorkflows, deleteWorkflow } from '../api';

export default function WorkflowList({ go, showToast }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [error, setError]         = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await getWorkflows(search, page);
      setWorkflows(res.workflows);
      setTotal(res.total);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, page]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteWorkflow(id);
      showToast('Workflow deleted');
      load();
    } catch (e) { setError(e.message); }
  };

  const totalPages = Math.ceil(total / 10);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Workflows</div>
          <div className="page-sub">{total} workflow{total !== 1 ? 's' : ''} total</div>
        </div>
        <button className="btn btn-primary" onClick={() => go('editor', { workflowId: null })}>
          + Create Workflow
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Search workflows..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="loader"><div className="spinner" /> Loading...</div>
        ) : workflows.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◈</div>
            <h3>No workflows yet</h3>
            <p>Click "⚡ Demo Data" to load samples or create your first workflow.</p>
            <button className="btn btn-primary" onClick={() => go('editor', { workflowId: null })}>Create Workflow</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Steps</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map(wf => (
                  <tr key={wf.id}>
                    <td><span className="col-id mono">{wf.id.slice(0, 8)}…</span></td>
                    <td>
                      <div className="col-name">{wf.name}</div>
                      {wf.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{wf.description}</div>}
                    </td>
                    <td><span className="col-mono">{wf._count?.steps ?? 0} steps</span></td>
                    <td><span className="badge badge-blue">v{wf.version}</span></td>
                    <td>
                      <span className={`badge ${wf.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {wf.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => go('editor', { workflowId: wf.id })}>Edit</button>
                        <button className="btn btn-blue btn-xs"  onClick={() => go('execute', { workflowId: wf.id })}>Execute</button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(wf.id, wf.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}