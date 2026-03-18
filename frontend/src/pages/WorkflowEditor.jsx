import React, { useEffect, useState, useRef } from 'react';
import { getWorkflow, createWorkflow, updateWorkflow, createStep, updateStep, deleteStep } from '../api';

const STEP_TYPES = ['task', 'approval', 'notification'];

export default function WorkflowEditor({ go, workflowId, showToast }) {
  const isNew = !workflowId;
  const [wf, setWf]           = useState(null);
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [schema, setSchema]   = useState([{ field: '', type: 'string', required: true, allowed: '' }]);
  const [steps, setSteps]     = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    if (!isNew) {
      getWorkflow(workflowId)
        .then(data => {
          setWf(data);
          setName(data.name);
          setDesc(data.description);
          // Parse input_schema into rows
          const rows = Object.entries(data.input_schema || {}).map(([field, v]) => ({
            field, type: v.type || 'string', required: v.required ?? true, allowed: (v.allowed_values || []).join(',')
          }));
          setSchema(rows.length ? rows : [{ field: '', type: 'string', required: true, allowed: '' }]);
          setSteps(data.steps || []);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [workflowId]);

  const buildSchema = () => {
    const obj = {};
    schema.forEach(row => {
      if (!row.field.trim()) return;
      obj[row.field] = {
        type: row.type,
        required: row.required,
        ...(row.allowed && { allowed_values: row.allowed.split(',').map(s => s.trim()).filter(Boolean) })
      };
    });
    return obj;
  };

  const handleSaveWorkflow = async () => {
    if (!name.trim()) { setError('Workflow name is required'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) {
        const created = await createWorkflow({ name, description: desc, input_schema: buildSchema() });
        showToast('Workflow created!');
        go('editor', { workflowId: created.id });
      } else {
        await updateWorkflow(workflowId, { name, description: desc, input_schema: buildSchema() });
        showToast('Workflow saved (new version)');
      }
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleAddStep = async () => {
    if (isNew) { setError('Save the workflow first before adding steps'); return; }
    try {
      const step = await createStep(workflowId, {
        name: `Step ${steps.length + 1}`, step_type: 'task', order: steps.length + 1, metadata: {}
      });
      setSteps(p => [...p, { ...step, rules: [] }]);
      // Auto set start_step_id if first step
      if (steps.length === 0) {
        await updateWorkflow(workflowId, { start_step_id: step.id });
      }
    } catch (e) { setError(e.message); }
  };

  const handleUpdateStep = async (step) => {
    try {
      const updated = await updateStep(step.id, { name: step.name, step_type: step.step_type, order: step.order });
      setSteps(p => p.map(s => s.id === step.id ? { ...s, ...updated } : s));
    } catch (e) { setError(e.message); }
  };

  const handleDeleteStep = async (id) => {
    if (!window.confirm('Delete this step and all its rules?')) return;
    try {
      await deleteStep(id);
      setSteps(p => p.filter(s => s.id !== id));
      showToast('Step deleted');
    } catch (e) { setError(e.message); }
  };

  const onDragStart = (i)  => { dragIdx.current = i; };
  const onDragEnter = (i)  => { setDragOver(i); };
  const onDragEnd   = async () => {
    if (dragIdx.current === null || dragOver === null || dragIdx.current === dragOver) {
      dragIdx.current = null; setDragOver(null); return;
    }
    const next = [...steps];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(dragOver, 0, moved);
    const reordered = next.map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(reordered);
    dragIdx.current = null; setDragOver(null);
    // Save new order
    for (const s of reordered) await updateStep(s.id, { order: s.order }).catch(() => {});
  };

  if (loading) return <div className="loader"><div className="spinner" /> Loading...</div>;

  return (
    <div>
      <div className="back-btn" onClick={() => go('list')}>← Back to Workflows</div>

      <div className="page-header">
        <div>
          <div className="page-title">{isNew ? 'Create Workflow' : `Edit: ${wf?.name}`}</div>
          {!isNew && <div className="page-sub">Version {wf?.version} — editing creates a new version</div>}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Workflow details */}
      <div className="form-card" style={{ marginBottom: 16 }}>
        <div className="form-section">Workflow details</div>
        <div className="form-row">
          <label className="form-label">Name *</label>
          <input className="form-input" placeholder="e.g. Expense Approval" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" placeholder="What does this workflow do?" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        {/* Input Schema */}
        <div className="form-section" style={{ marginTop: 20 }}>Input schema</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
          Define what fields are required when executing this workflow
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 1fr auto', gap: 8, marginBottom: 8 }}>
          {['Field name', 'Type', 'Required', 'Allowed values (comma separated)', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
          ))}
        </div>

        {schema.map((row, i) => (
          <div key={i} className="schema-row">
            <input className="form-input" placeholder="field_name" value={row.field} onChange={e => setSchema(p => p.map((r, j) => j === i ? { ...r, field: e.target.value } : r))} />
            <select className="form-select" value={row.type} onChange={e => setSchema(p => p.map((r, j) => j === i ? { ...r, type: e.target.value } : r))}>
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            <select className="form-select" value={row.required} onChange={e => setSchema(p => p.map((r, j) => j === i ? { ...r, required: e.target.value === 'true' } : r))}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
            <input className="form-input" placeholder="High,Medium,Low" value={row.allowed} onChange={e => setSchema(p => p.map((r, j) => j === i ? { ...r, allowed: e.target.value } : r))} />
            <button className="btn btn-danger btn-xs" onClick={() => setSchema(p => p.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setSchema(p => [...p, { field: '', type: 'string', required: true, allowed: '' }])}>+ Add field</button>

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleSaveWorkflow} disabled={saving}>
            {saving ? 'Saving...' : isNew ? '✓ Create Workflow' : '✓ Save Changes'}
          </button>
        </div>
      </div>

      {/* Steps */}
      {!isNew && (
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="form-section" style={{ margin: 0, border: 'none', padding: 0 }}>Steps</div>
            <button className="btn btn-ghost btn-sm" onClick={handleAddStep}>+ Add Step</button>
          </div>

          {steps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              No steps yet — add your first step
            </div>
          ) : (
            steps.map((step, i) => (
              <div
                key={step.id}
                className={`step-row ${dragOver === i ? 'drag-over' : ''}`}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDragEnd={onDragEnd}
              >
                <span className="drag-handle">⠿</span>
                <span className="step-num">{i + 1}</span>
                <input
                  className="form-input"
                  value={step.name}
                  onChange={e => setSteps(p => p.map(s => s.id === step.id ? { ...s, name: e.target.value } : s))}
                  onBlur={() => handleUpdateStep(step)}
                  style={{ flex: 2 }}
                />
                <select
                  className="form-select"
                  value={step.step_type}
                  onChange={e => { const updated = { ...step, step_type: e.target.value }; setSteps(p => p.map(s => s.id === step.id ? updated : s)); handleUpdateStep(updated); }}
                  style={{ flex: 1 }}
                >
                  {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className={`badge ${step.step_type === 'approval' ? 'type-approval' : step.step_type === 'notification' ? 'type-notification' : 'type-task'}`}>
                  {step.step_type}
                </span>
                <button className="btn btn-blue btn-xs" onClick={() => go('rules', { stepId: step.id, workflowId })}>
                  Rules ({step.rules?.length || 0})
                </button>
                <button className="btn btn-danger btn-xs" onClick={() => handleDeleteStep(step.id)}>✕</button>
              </div>
            ))
          )}
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 10 }}>
            ⠿ Drag to reorder &nbsp;·&nbsp; Click "Rules" to define routing for each step
          </div>
        </div>
      )}
    </div>
  );
}