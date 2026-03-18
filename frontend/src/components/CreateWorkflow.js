import React, { useState } from 'react';
import { createWorkflow } from '../api';

function CreateWorkflow({ onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([{ name: '', type: 'ACTION', config: {} }]);
  const [message, setMessage] = useState('');

  const addStep = () => {
    setSteps([...steps, { name: '', type: 'ACTION', config: {} }]);
  };

  const updateStep = (index, field, value) => {
    const updated = [...steps];
    updated[index][field] = value;
    setSteps(updated);
  };

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return setMessage('Workflow name is required!');
    try {
      await createWorkflow({ name, description, steps });
      setMessage('Workflow created successfully!');
      setName('');
      setDescription('');
      setSteps([{ name: '', type: 'ACTION', config: {} }]);
      if (onCreated) onCreated();
    } catch (err) {
      setMessage('Error creating workflow');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Create New Workflow</h2>
      {message && (
        <div style={{ background: message.includes('Error') ? '#f8d7da' : '#d4edda', color: message.includes('Error') ? '#721c24' : '#155724', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
          {message}
        </div>
      )}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Workflow Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Email Notification Flow"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..."
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', height: '80px' }} />
        </div>

        <h3 style={{ marginBottom: '12px', color: '#444' }}>Steps</h3>
        {steps.map((step, index) => (
          <div key={index} style={{ background: '#f8f9fa', padding: '14px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <input value={step.name} onChange={e => updateStep(index, 'name', e.target.value)}
                placeholder={`Step ${index + 1} name`}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }} />
              <select value={step.type} onChange={e => updateStep(index, 'type', e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}>
                <option value="TRIGGER">TRIGGER</option>
                <option value="ACTION">ACTION</option>
                <option value="CONDITION">CONDITION</option>
                <option value="DELAY">DELAY</option>
              </select>
              <button onClick={() => removeStep(index)}
                style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        ))}

        <button onClick={addStep}
          style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '16px' }}>
          + Add Step
        </button>

        <br />
        <button onClick={handleSubmit}
          style={{ background: '#007bff', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
          Create Workflow
        </button>
      </div>
    </div>
  );
}

export default CreateWorkflow;