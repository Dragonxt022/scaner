const { processDocument } = require('./indexer');
const {
  getMaintenanceInsights,
  listMaintenanceCandidates,
  resetDocumentsByIds,
} = require('./repository');

function normalizeStrategy(strategy) {
  return typeof strategy === 'string' ? strategy.trim() : '';
}

function normalizeAction(action) {
  return typeof action === 'string' ? action.trim() : 'preview';
}

function normalizeMode(mode) {
  return typeof mode === 'string' && mode ? mode : 'hybrid';
}

function previewMaintenance({ strategy, limit }) {
  const normalizedStrategy = normalizeStrategy(strategy);
  return {
    insights: getMaintenanceInsights(),
    items: listMaintenanceCandidates(normalizedStrategy, limit),
    strategy: normalizedStrategy,
  };
}

async function runMaintenanceAction({ action, limit, mode, resetAttempts = true, strategy }) {
  const normalizedStrategy = normalizeStrategy(strategy);
  const normalizedAction = normalizeAction(action);
  const normalizedMode = normalizeMode(mode);
  const candidates = listMaintenanceCandidates(normalizedStrategy, limit);

  if (!candidates.length) {
    return {
      action: normalizedAction,
      insights: getMaintenanceInsights(),
      items: [],
      processed: 0,
      strategy: normalizedStrategy,
    };
  }

  if (normalizedAction === 'clear_to_pending') {
    const result = resetDocumentsByIds(candidates.map((item) => item.id), { resetAttempts });
    return {
      action: normalizedAction,
      insights: getMaintenanceInsights(),
      items: candidates,
      processed: result.affectedGroups,
      resetSummary: result,
      strategy: normalizedStrategy,
    };
  }

  if (normalizedAction === 'reprocess_now') {
    const resetSummary = resetDocumentsByIds(candidates.map((item) => item.id), { resetAttempts });
    const results = [];
    for (const candidate of candidates) {
      results.push(await processDocument(candidate, { mode: normalizedMode }));
    }

    return {
      action: normalizedAction,
      insights: getMaintenanceInsights(),
      items: candidates,
      mode: normalizedMode,
      processed: results.length,
      resetSummary,
      results,
      strategy: normalizedStrategy,
    };
  }

  return {
    action: 'preview',
    insights: getMaintenanceInsights(),
    items: candidates,
    processed: 0,
    strategy: normalizedStrategy,
  };
}

module.exports = {
  previewMaintenance,
  runMaintenanceAction,
};
