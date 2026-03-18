const express = require('express');
const router = express.Router();
const { getAllWorkflows, getWorkflowById, createWorkflow, updateWorkflow, deleteWorkflow } = require('../controllers/workflowController');

router.get('/', getAllWorkflows);
router.get('/:id', getWorkflowById);
router.post('/', createWorkflow);
router.put('/:id', updateWorkflow);
router.delete('/:id', deleteWorkflow);

module.exports = router;