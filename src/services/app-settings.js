const { defineModels } = require('../db/models');

const DEFAULTS = {
  autoIndexOnDetailView: 'false',
  enrichmentApiKey: '',
  enrichmentBatchLimit: '5',
  enrichmentBaseUrl: '',
  enrichmentModel: '',
  enrichmentOverwritePreviewImages: 'false',
  enrichmentOverwriteSummary: 'false',
  enrichmentProcessMode: 'both',
  enrichmentPreviewImageCount: '1',
  enrichmentPreviewImageQuality: 'balanced',
  enrichmentPreviewImagesEnabled: 'false',
  enrichmentProvider: 'disabled',
  enrichmentSummaryEnabled: 'true',
};

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

function normalizeInteger(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

async function ensureDefaultSettings() {
  const { AppSetting } = defineModels();
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await AppSetting.findOrCreate({
      defaults: { value },
      where: { key },
    });
  }
}

async function getAppSettings() {
  await ensureDefaultSettings();
  const { AppSetting } = defineModels();
  const rows = await AppSetting.findAll();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    autoIndexOnDetailView: normalizeBoolean(values.autoIndexOnDetailView, false),
    enrichmentApiKey: values.enrichmentApiKey || '',
    enrichmentBatchLimit: normalizeInteger(values.enrichmentBatchLimit, 5, { min: 1, max: 50 }),
    enrichmentBaseUrl: values.enrichmentBaseUrl || '',
    enrichmentModel: values.enrichmentModel || '',
    enrichmentOverwritePreviewImages: normalizeBoolean(values.enrichmentOverwritePreviewImages, false),
    enrichmentOverwriteSummary: normalizeBoolean(values.enrichmentOverwriteSummary, false),
    enrichmentProcessMode: ['both', 'summary_only', 'images_only'].includes(values.enrichmentProcessMode)
      ? values.enrichmentProcessMode
      : 'both',
    enrichmentPreviewImageCount: normalizeInteger(values.enrichmentPreviewImageCount, 1, { min: 1, max: 5 }),
    enrichmentPreviewImageQuality: ['low', 'balanced', 'high'].includes(values.enrichmentPreviewImageQuality)
      ? values.enrichmentPreviewImageQuality
      : 'balanced',
    enrichmentPreviewImagesEnabled: normalizeBoolean(values.enrichmentPreviewImagesEnabled, false),
    enrichmentProvider: values.enrichmentProvider || 'disabled',
    enrichmentSummaryEnabled: normalizeBoolean(values.enrichmentSummaryEnabled, true),
      localLibraryAutoSync: normalizeBoolean(values.localLibraryAutoSync, false),
  };
}

async function updateAppSettings(patch = {}) {
  const current = await getAppSettings();
  const next = {
    autoIndexOnDetailView: Object.prototype.hasOwnProperty.call(patch, 'autoIndexOnDetailView')
      ? normalizeBoolean(patch.autoIndexOnDetailView, current.autoIndexOnDetailView)
      : current.autoIndexOnDetailView,
    enrichmentApiKey: Object.prototype.hasOwnProperty.call(patch, 'enrichmentApiKey')
      ? String(patch.enrichmentApiKey ?? '').trim()
      : current.enrichmentApiKey,
    enrichmentBatchLimit: Object.prototype.hasOwnProperty.call(patch, 'enrichmentBatchLimit')
      ? normalizeInteger(patch.enrichmentBatchLimit, current.enrichmentBatchLimit, { min: 1, max: 50 })
      : current.enrichmentBatchLimit,
    enrichmentBaseUrl: Object.prototype.hasOwnProperty.call(patch, 'enrichmentBaseUrl')
      ? String(patch.enrichmentBaseUrl ?? '').trim()
      : current.enrichmentBaseUrl,
    enrichmentModel: Object.prototype.hasOwnProperty.call(patch, 'enrichmentModel')
      ? String(patch.enrichmentModel ?? '').trim()
      : current.enrichmentModel,
    enrichmentOverwritePreviewImages: Object.prototype.hasOwnProperty.call(patch, 'enrichmentOverwritePreviewImages')
      ? normalizeBoolean(patch.enrichmentOverwritePreviewImages, current.enrichmentOverwritePreviewImages)
      : current.enrichmentOverwritePreviewImages,
    enrichmentOverwriteSummary: Object.prototype.hasOwnProperty.call(patch, 'enrichmentOverwriteSummary')
      ? normalizeBoolean(patch.enrichmentOverwriteSummary, current.enrichmentOverwriteSummary)
      : current.enrichmentOverwriteSummary,
    enrichmentProcessMode: Object.prototype.hasOwnProperty.call(patch, 'enrichmentProcessMode')
      ? (['both', 'summary_only', 'images_only'].includes(String(patch.enrichmentProcessMode ?? '').trim())
        ? String(patch.enrichmentProcessMode).trim()
        : current.enrichmentProcessMode)
      : current.enrichmentProcessMode,
    enrichmentPreviewImageCount: Object.prototype.hasOwnProperty.call(patch, 'enrichmentPreviewImageCount')
      ? normalizeInteger(patch.enrichmentPreviewImageCount, current.enrichmentPreviewImageCount, { min: 1, max: 5 })
      : current.enrichmentPreviewImageCount,
    enrichmentPreviewImageQuality: Object.prototype.hasOwnProperty.call(patch, 'enrichmentPreviewImageQuality')
      ? (['low', 'balanced', 'high'].includes(String(patch.enrichmentPreviewImageQuality ?? '').trim())
        ? String(patch.enrichmentPreviewImageQuality).trim()
        : current.enrichmentPreviewImageQuality)
      : current.enrichmentPreviewImageQuality,
    enrichmentPreviewImagesEnabled: Object.prototype.hasOwnProperty.call(patch, 'enrichmentPreviewImagesEnabled')
      ? normalizeBoolean(patch.enrichmentPreviewImagesEnabled, current.enrichmentPreviewImagesEnabled)
      : current.enrichmentPreviewImagesEnabled,
    enrichmentProvider: Object.prototype.hasOwnProperty.call(patch, 'enrichmentProvider')
      ? String(patch.enrichmentProvider ?? '').trim() || 'disabled'
      : current.enrichmentProvider,
    enrichmentSummaryEnabled: Object.prototype.hasOwnProperty.call(patch, 'enrichmentSummaryEnabled')
      ? normalizeBoolean(patch.enrichmentSummaryEnabled, current.enrichmentSummaryEnabled)
      : current.enrichmentSummaryEnabled,
    localLibraryAutoSync: Object.prototype.hasOwnProperty.call(patch, 'localLibraryAutoSync')
      ? normalizeBoolean(patch.localLibraryAutoSync, current.localLibraryAutoSync)
      : current.localLibraryAutoSync,
  };

  const { AppSetting } = defineModels();
  const entries = [
    ['autoIndexOnDetailView', next.autoIndexOnDetailView ? 'true' : 'false'],
    ['enrichmentApiKey', next.enrichmentApiKey],
    ['enrichmentBatchLimit', String(next.enrichmentBatchLimit)],
    ['enrichmentBaseUrl', next.enrichmentBaseUrl],
    ['enrichmentModel', next.enrichmentModel],
    ['enrichmentOverwritePreviewImages', next.enrichmentOverwritePreviewImages ? 'true' : 'false'],
    ['enrichmentOverwriteSummary', next.enrichmentOverwriteSummary ? 'true' : 'false'],
    ['enrichmentProcessMode', next.enrichmentProcessMode],
    ['enrichmentPreviewImageCount', String(next.enrichmentPreviewImageCount)],
    ['enrichmentPreviewImageQuality', next.enrichmentPreviewImageQuality],
    ['enrichmentPreviewImagesEnabled', next.enrichmentPreviewImagesEnabled ? 'true' : 'false'],
    ['enrichmentProvider', next.enrichmentProvider],
    ['enrichmentSummaryEnabled', next.enrichmentSummaryEnabled ? 'true' : 'false'],
    ['localLibraryAutoSync', next.localLibraryAutoSync ? 'true' : 'false'],
  ];

  for (const [key, value] of entries) {
    await AppSetting.upsert({ key, value });
  }

  return next;
}

module.exports = {
  getAppSettings,
  updateAppSettings,
};
