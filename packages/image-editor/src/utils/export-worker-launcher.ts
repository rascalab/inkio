export async function createExportWorker(): Promise<Worker> {
  return new Worker(new URL('./export-raster.worker.ts', import.meta.url), { type: 'module' });
}
