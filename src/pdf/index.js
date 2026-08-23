/**
 * APEX PDF Generator Entrypoint
 */

import { ApexPdfBuilder } from './pdf-builder.js';

export async function generatePdfReport(analysisReport, metadata = {}) {
  const builder = new ApexPdfBuilder();
  return await builder.build(analysisReport, metadata);
}

export { ApexPdfBuilder };
