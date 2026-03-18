import React, { useEffect, useState } from 'react';
import { getWorkflows, deleteWorkflow, triggerExecution } from '../api';

function WorkflowList({ onSelect }) {
  const [workflows, setWorkflows] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchWorkflows(); }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await getWorkflows();
      setWorkflows(res.data);
    } catch (err) {
      setMessage('Error loading workflows');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteWorkflow(id);
      setMessage('Workflow deleted!');
      fetchWorkflows();
    } catch (err) {
      setMessage('Error deleting workflow');
    }
  };

  const handleTrigger = async (id) => {
    try {
      await triggerExecution(id);
      setMessage('Workflow executed successfully!');
    } catch (err) {
      setMessage('Error triggering workflow');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '16px', color: '#1a1a2e' }}>All Workflows</h2>
      {message && <div style={{ background: '#d4edda', color: '#155724', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>{message}</div>}
      {workflows.length === 0 && <p style={{ color: '#888' }}>No workflows yet. Create one!</p>}
      {workflows.map(wf => (
        <div key={wf.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#1a1a2e' }}>{wf.name}</h3>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>{wf.description || 'No description'}</p>
              <span style={{ fontSize: '12px', background: wf.isActive ? '#d4edda' : '#f8d7da', color: wf.isActive ? '#155724' : '#721c24', padding: '2px 8px', borderRadius: '12px', marginTop: '6px', display: 'inline-block' }}>
                {wf.isActive ? 'Active' : 'Inactive'}
              </span>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{wf.steps?.length || 0} steps</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleTrigger(wf.id)} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>▶ Run</button>
              <button onClick={() => onSelect(wf.id)} style={{ background: '#007bff', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>📋 Logs</button>
              <button onClick={() => handleDelete(wf.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>🗑 Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WorkflowList;