const prisma = require('../utils/prismaClient');

const triggerExecution = async (req, res) => {
  try {
    const { workflowId } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { include: { rules: true }, orderBy: { order: 'asc' } } }
    });

    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const execution = await prisma.execution.create({
      data: { workflowId, status: 'RUNNING', logs: [] }
    });

    const logs = [];
    for (const step of workflow.steps) {
      logs.push({
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        status: 'SUCCESS',
        executedAt: new Date()
      });
    }

    const completed = await prisma.execution.update({
      where: { id: execution.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), logs }
    });

    res.status(201).json(completed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getExecutions = async (req, res) => {
  try {
    const executions = await prisma.execution.findMany({
      where: { workflowId: req.params.workflowId },
      orderBy: { startedAt: 'desc' }
    });
    res.json(executions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { triggerExecution, getExecutions };