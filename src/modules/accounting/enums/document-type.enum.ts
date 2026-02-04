/**
 * Tipos de documento que generan asientos contables automáticos.
 * Alineado con DianDocumentType donde aplica.
 */
export enum AccountingDocumentType {
  FACTURA_VENTA = 'FACTURA_VENTA',
  FACTURA_POS = 'FACTURA_POS',
  NOTA_CREDITO = 'NOTA_CREDITO',
  NOTA_DEBITO = 'NOTA_DEBITO',
  COMPRA = 'COMPRA',
}
