import React, { useEffect, useState } from 'react';
import { getExecutions } from '../api';

function ExecutionLogs({ workflowId, onBack }) {
  const [executions, setExecutions] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (workflowId) fetchExecutions();
  }, [workflowId]);

  const fetchExecutions = async () => {
    try {
      const res = await getExecutions(workflowId);
      setExecutions(res.data);
    } catch (err) {
      setMessage('Error loading executions');
    }
  };

  const statusColor = (status) => {
    if (status === 'SUCCESS') return { background: '#d4edda', color: '#155724' };
    if (status === 'FAILED') return { background: '#f8d7da', color: '#721c24' };
    return { background: '#fff3cd', color: '#856404' };
  };

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={onBack}
        style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '16px' }}>
        ← Back
      </button>
      <h2 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Execution Logs</h2>
      {message && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>{message}</div>}
      {executions.length === 0 && <p style={{ color: '#888' }}>No executions yet. Click ▶ Run on a workflow!</p>}
      {executions.map(exec => (
        <div key={exec.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>ID: {exec.id.slice(0, 8)}...</span>
            <span style={{ ...statusColor(exec.status), padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600' }}>
              {exec.status}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#666', margin: '4px 0' }}>
            Started: {new Date(exec.startedAt).toLocaleString()}
          </p>
          {exec.finishedAt && (
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0' }}>
              Finished: {new Date(exec.finishedAt).toLocaleString()}
            </p>
          )}
          {exec.logs && exec.logs.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontWeight: '600', marginBottom: '6px' }}>Step Logs:</p>
              {exec.logs.map((log, i) => (
                <div key={i} style={{ background: '#f8f9fa', padding: '8px', borderRadius: '6px', marginBottom: '4px', fontSize: '13px' }}>
                  <span style={{ fontWeight: '600' }}>{log.stepName}</span>
                  <span style={{ ...statusColor(log.status), padding: '2px 8px', borderRadius: '10px', fontSize: '12px', marginLeft: '8px' }}>{log.status}</span>
                  <span style={{ color: '#999', marginLeft: '8px' }}>{new Date(log.executedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ExecutionLogs;