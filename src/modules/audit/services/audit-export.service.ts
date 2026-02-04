import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { DianHistoryResult } from './dian-audit.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

/**
 * Exportación del historial de auditoría DIAN a Excel o PDF.
 */
@Injectable()
export class AuditExportService {
  async exportHistory(
    result: DianHistoryResult,
    format: 'pdf' | 'excel',
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    if (format === 'excel') {
      const buffer = await this.toExcel(result);
      return {
        buffer,
        filename: `auditoria_dian_${result.fullNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    const buffer = await this.toPdf(result);
    return {
      buffer,
      filename: `auditoria_dian_${result.fullNumber}_${new Date().toISOString().slice(0, 10)}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  private async toExcel(result: DianHistoryResult): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Historial DIAN');
    ws.columns = [{ width: 22 }, { width: 18 }, { width: 50 }, { width: 12 }];
    ws.getCell('A1').value = `Auditoría DIAN - Factura ${result.fullNumber}`;
    ws.getCell('A1').font = { bold: true, size: 12 };
    ws.getCell('A2').value = `CUFE: ${result.cufe ?? 'N/A'} | Estado: ${result.status} | DIAN: ${result.statusDian ?? 'N/A'}`;
    ws.addRow([]);
    ws.addRow(['Fecha/hora', 'Tipo', 'Descripción', 'Origen']);
    ws.lastRow!.font = { bold: true };
    for (const e of result.entries) {
      ws.addRow([e.at, e.type, e.description, e.source]);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private async toPdf(result: DianHistoryResult): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(14).text(`Auditoría DIAN - Factura ${result.fullNumber}`, { align: 'center' });
    doc.fontSize(10).text(`CUFE: ${result.cufe ?? 'N/A'} | Estado: ${result.status} | DIAN: ${result.statusDian ?? 'N/A'}`, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(9);
    for (const e of result.entries) {
      doc.text(`${e.at.slice(0, 19)} | ${e.type} | ${e.description}`, { continued: false });
      doc.moveDown(0.3);
    }
    doc.end();
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
