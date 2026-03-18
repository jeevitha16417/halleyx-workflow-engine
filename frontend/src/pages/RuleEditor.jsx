import React, { useEffect, useState } from 'react';
import { getRules, createRule, updateRule, deleteRule, getWorkflow } from '../api';

const OPERATORS = ['==', '!=', '>', '<', '>=', '<=', '&&', '||'];

export default function RuleEditor({ go, stepId, workflowId, showToast }) {
  const [rules, setRules]       = useState([]);
  const [steps, setSteps]       = useState([]);
  const [stepName, setStepName] = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ condition: '', next_step_id: '', priority: 10 });
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    Promise.all([getRules(stepId), getWorkflow(workflowId)])
      .then(([r, wf]) => {
        setRules(r);
        setSteps(wf.steps || []);
        const s = wf.steps.find(s => s.id === stepId);
        setStepName(s?.name || 'Step');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [stepId, workflowId]);

  const resetForm = () => { setForm({ condition: '', next_step_id: '', priority: 10 }); setEditId(null); };

  const handleSave = async () => {
    if (!form.condition.trim()) { setError('Condition is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        condition: form.condition,
        next_step_id: form.next_step_id || null,
        priority: parseInt(form.priority) || 10
      };
      if (editId) {
        const updated = await updateRule(editId, payload);
        setRules(p => p.map(r => r.id === editId ? updated : r));
        showToast('Rule updated');
      } else {
        const created = await createRule(stepId, payload);
        setRules(p => [...p, created]);
        showToast('Rule added');
      }
      resetForm();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleEdit = (rule) => {
    setForm({ condition: rule.condition, next_step_id: rule.next_step_id || '', priority: rule.priority });
    setEditId(rule.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await deleteRule(id);
      setRules(p => p.filter(r => r.id !== id));
      showToast('Rule deleted');
    } catch (e) { setError(e.message); }
  };

  const otherSteps = steps.filter(s => s.id !== stepId);

  if (loading) return <div className="loader"><div className="spinner" /> Loading...</div>;

  return (
    <div>
      <div className="back-btn" onClick={() => go('editor', { workflowId })}>← Back to Workflow Editor</div>

      <div className="page-header">
        <div>
          <div className="page-title">Rule Editor</div>
          <div className="page-sub">Step: <strong>{stepName}</strong> — define routing rules by priority</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Rules table */}
      <div className="card" style={{ marginBottom: 20 }}>
        {rules.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            No rules yet — add the first rule below
          </div>
        ) : (
          <div className="table-wrap">
            <table className="rules-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Condition</th>
                  <th>Next step</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...rules].sort((a, b) => a.priority - b.priority).map(rule => {
                  const nextStep = steps.find(s => s.id === rule.next_step_id);
                  const isDefault = rule.condition.trim().toUpperCase() === 'DEFAULT';
                  return (
                    <tr key={rule.id}>
                      <td><div className="priority-badge">{rule.priority}</div></td>
                      <td>
                        <span className={isDefault ? 'rule-default' : 'rule-condition'}>
                          {rule.condition}
                        </span>
                      </td>
                      <td>
                        {rule.next_step_id
                          ? <span className="badge badge-blue">{nextStep?.name || rule.next_step_id.slice(0, 8)}</span>
                          : <span className="badge badge-green">END workflow</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => handleEdit(rule)}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(rule.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit rule form */}
      <div className="form-card">
        <div className="form-section">{editId ? 'Edit Rule' : 'Add New Rule'}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="form-row" style={{ margin: 0 }}>
            <label className="form-label">Condition *</label>
            <input
              className="form-input"
              placeholder="amount > 100 && country == 'US'"
              value={form.condition}
              onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}
            />
            <div className="form-hint">Use DEFAULT as catch-all. Operators: == != &gt; &lt; &gt;= &lt;= &amp;&amp; ||</div>
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label className="form-label">Next Step</label>
            <select className="form-select" value={form.next_step_id} onChange={e => setForm(p => ({ ...p, next_step_id: e.target.value }))}>
              <option value="">— End workflow (null) —</option>
              {otherSteps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Priority (lower = evaluated first)</label>
          <input
            className="form-input"
            style={{ maxWidth: 120 }}
            type="number"
            min="1"
            value={form.priority}
            onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editId ? '✓ Update Rule' : '+ Add Rule'}
          </button>
          {editId && <button className="btn btn-ghost" onClick={resetForm}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}