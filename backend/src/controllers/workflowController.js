const prisma = require('../utils/prismaClient');

const getAllWorkflows = async (req, res) => {
  try {
    const workflows = await prisma.workflow.findMany({ include: { steps: { include: { rules: true } } } });
    res.json(workflows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
const getWorkflowById = async (req, res) => {
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: req.params.id }, include: { steps: { include: { rules: true } } } });
    if (!workflow) return res.status(404).json({ error: 'Not found' });
    res.json(workflow);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
const createWorkflow = async (req, res) => {
  try {
    const { name, description, steps } = req.body;
    const workflow = await prisma.workflow.create({
      data: { name, description, steps: { create: steps?.map((step, index) => ({ name: step.name, type: step.type, config: step.config || {}, order: index + 1, rules: { create: step.rules?.map(r => ({ field: r.field, operator: r.operator, value: r.value })) || [] } })) || [] } },
      include: { steps: { include: { rules: true } } }
    });
    res.status(201).json(workflow);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
const updateWorkflow = async (req, res) => {
  try {
    const workflow = await prisma.workflow.update({ where: { id: req.params.id }, data: req.body });
    res.json(workflow);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
const deleteWorkflow = async (req, res) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { getAllWorkflows, getWorkflowById, createWorkflow, updateWorkflow, deleteWorkflow };