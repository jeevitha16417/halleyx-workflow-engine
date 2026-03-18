const express = require('express');
const router = express.Router();
const { triggerExecution, getExecutions } = require('../controllers/executionController');

router.post('/:workflowId/trigger', triggerExecution);
router.get('/:workflowId/executions', getExecutions);

module.exports = router;