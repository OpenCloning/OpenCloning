export const formatGcContent = (gcContent) => (gcContent !== undefined ? Number((gcContent * 100).toFixed(0)) : '');
export const formatMeltingTemperature = (meltingTemperature) => (meltingTemperature !== undefined ? Number(meltingTemperature.toFixed(1)) : '');
export const formatDeltaG = (deltaG) => (deltaG !== undefined ? Number(deltaG.toFixed(0)) : '');
