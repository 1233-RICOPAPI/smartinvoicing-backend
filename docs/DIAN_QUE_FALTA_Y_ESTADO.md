# MottaTech vs requisitos DIAN – Qué exige la DIAN y qué tenemos

Basado en la normativa vigente (Resolución 000165 de 2023, Anexo Técnico v1.9, resoluciones modificatorias 2024-2025) y en referencias de software certificados (p. ej. Alegra, Siigo).

---

## Lo que EXIGE la DIAN (resumen)

### 1. Documentos electrónicos con validación previa

- **Factura Electrónica de Venta** (UBL 2.1 Invoice).
- **Nota Crédito** y **Nota Débito** (UBL 2.1 CreditNote / DebitNote).
- **Documento equivalente**: tiquete POS electrónico (mismo estándar UBL, tipo 04).
- **Validación previa**: el XML se envía a la DIAN y solo tras respuesta favorable se entrega el documento al cliente (no expedir antes de validar).

### 2. Elementos técnicos obligatorios

- **CUFE** (Código Único de Factura Electrónica): fórmula oficial, SHA-384, 96 caracteres hex.
- **Código QR**: debe permitir consultar/validar la factura (p. ej. URL de verificación DIAN o datos que lleven a esa consulta).
- **Representación gráfica (PDF)** en español con:
  - Denominación “Factura Electrónica de venta” (o “Nota Crédito”, “Nota Débito”, “Factura POS”, según el caso).
  - Datos del vendedor y del adquiriente (nombre/razón social, NIT).
  - Número de autorización DIAN y consecutivo.
  - Fecha, hora, cantidad, descripción y valor de la operación.
  - Forma y medio de pago (cuando aplique).
  - Tarifa y valor del IVA e impuesto al consumo (si aplica).
  - Número y datos del CUFE.
  - Código QR vinculado a la consulta de la factura.

- **Firma digital**: certificado válido (ONAC), firma del XML (p. ej. XAdES) antes del envío.

### 3. Habilitación y operación

- RUT actualizado, correo en RUT.
- **Certificado de firma digital** (o uso de Facturación Gratuita / Proveedor Tecnológico).
- **Numeración autorizada**: rangos de numeración autorizados por la DIAN (resolución, prefijo, vigencia).
- Modo: **Desarrollador propio** (integración directa con Web Services DIAN) o **Proveedor Tecnológico** (PT).

### 4. Otros documentos DIAN (no solo facturación de venta)

- **Documento Soporte en Adquisiciones (DSE)**: para compras a **no obligados** a expedir factura. Lleva **CUDS** (no CUFE), formato y reglas propias (Resolución 000167 de 2021). Lo emite el **comprador**.

---

## Lo que MottaTech YA TIENE (alineado con DIAN)

| Requisito DIAN | Estado en MottaTech |
|----------------|---------------------|
| Factura Electrónica de Venta (UBL 2.1) | ✅ `ubl-invoice.builder.ts`, firma, envío |
| Nota Crédito (UBL 2.1) | ✅ `ubl-credit-note.builder.ts`, BillingReference, CUFE 91, firma y flujo en `DianService` |
| Nota Débito (UBL 2.1) | ✅ `ubl-debit-note.builder.ts`, BillingReference, CUFE 92, firma y flujo en `DianService` |
| Factura POS (documento equivalente) | ✅ Tipo 04, numeración POS, flujo `PosInvoiceService` + `emit-pos-electronic` |
| CUFE (obligatorio + opcionales) | ✅ `CufeService.generateCufeExtended`, SHA-384, tests unitarios |
| Código QR (validación) | ✅ `QrService.buildValidationUrl` + `buildQrData`, QR en PDF |
| Firma digital (XAdES, .p12) | ✅ `SignerService.signXml` con certificado en `DianConfig` |
| Numeración autorizada | ✅ `DianResolutionService`: prefijos, rangos, vigencias por tipo (venta, POS, NC, ND) |
| Envío a DIAN (validación previa) | ✅ `DianApiService`: GetToken, SendBillSync; no se “entrega” documento antes de respuesta |
| Estados y trazabilidad | ✅ Invoice + DianDocument + DianEvent + `dian_history` (MongoDB), reintentos (máx. 3) |
| Representación gráfica PDF | ✅ `PdfGeneratorService`: datos emisor/comprador, número, fecha, detalle, totales, IVA, QR |
| Contabilidad (partida doble, retenciones) | ✅ Motor contable, reportes, snapshots, cierre de mes |

---

## Lo que FALTA o conviene reforzar (vs DIAN y vs referentes Siigo/Alegra)

### 1. Documento Soporte Electrónico (DSE)

- **Qué es**: documento que emite el **comprador** cuando compra a un **no obligado** a facturar.
- **Estado**: ❌ No implementado (XML/CUDS y flujo propios).
- **Prioridad**: Media–alta si el producto apunta a empresas que compran a no obligados y quieren soportar costos/deducciones ante la DIAN.

### 2. Representación gráfica (PDF) – detalle DIAN

- **Forma y medio de pago**: la DIAN exige que la representación gráfica incluya forma y medio de pago. Hoy el PDF puede no incluirlos de forma explícita si no se pasan desde la factura/pagos.
- **Acción**: Revisar que el PDF incluya forma y medio de pago (p. ej. desde `InvoicePayment` o equivalente) y denominación exacta según tipo (“Factura Electrónica de venta”, “Nota Crédito”, “Factura POS”, etc.).
- **Número de autorización**: en el PDF debe quedar claro el “número de autorización” (consecutivo/autorización); actualmente se usa el número de factura; validar que cumpla con lo que la DIAN entiende por “autorización y consecutivo”.

### 3. POS – consumidor final

- La DIAN permite documento equivalente (POS) con **adquirente no identificado** (consumidor final).
- **Estado**: Hay que confirmar que el flujo POS permita cliente “consumidor final” (NIT/identificación opcional o valor por defecto) y que el XML UBL y el PDF sigan siendo válidos (campos opcionales o valores genéricos según anexo).

### 4. Consulta de estado en la DIAN (opcional pero útil)

- Hoy el “estado” se obtiene de la base propia (respuesta del último envío). Algunos integradores consultan además el estado en la DIAN (p. ej. GetStatusZip o equivalente del ambiente).
- **Estado**: No hay consulta directa al Web Service de estado DIAN.
- **Prioridad**: Baja para certificación; útil para reconciliación y soporte.

### 5. Envío de factura/PDF por correo al cliente

- La DIAN no exige el envío por email; sí exige que la representación gráfica exista y tenga los datos indicados.
- Software como Alegra/Siigo suelen **enviar por correo** la factura o el PDF al cliente.
- **Estado**: ❌ No implementado (no hay envío automático de email con PDF/XML).
- **Prioridad**: Media para experiencia de uso y paridad con competencia.

### 6. Anexo técnico 1.9 – revisión fina

- **CustomizationID / ProfileID**: ya se usan (“10”, “DIAN 2.1”) en los builders UBL.
- **PaymentMeans (forma de pago) en el XML**: el estándar UBL permite `cac:PaymentMeans`. Si el anexo 1.9 lo marca como obligatorio en ciertos casos, hay que añadirlo al XML y al PDF.
- **Acción**: Revisar la lista exacta de elementos obligatorios del Anexo Técnico v1.9 para Invoice, CreditNote, DebitNote y POS y cruzar con los builders (y con el PDF).

### 7. Pruebas de certificación DIAN

- La DIAN suele pedir **pruebas exitosas** en ambiente de habilitación (p. ej. facturas, nota crédito, nota débito).
- **Estado**: El flujo técnico está; falta ejecutar el proceso formal de habilitación y las pruebas que pida la DIAN (incl. 2 facturas, 1 NC, 1 ND si aplica).

### 8. Proveedor Tecnológico (PT) vs desarrollo propio

- Si se certifica como **desarrollador propio**: hay que cumplir integración directa con los Web Services DIAN (como ya se hace con GetToken y SendBillSync).
- Si se usa **Proveedor Tecnológico**: la API actual podría adaptarse para enviar el XML al PT en lugar de a la DIAN; el resto (CUFE, firma, PDF, QR) sigue siendo responsabilidad del software.

---

## Resumen ejecutivo: qué falta

| # | Tema | Prioridad | Acción sugerida |
|---|------|-----------|------------------|
| 1 | **Documento Soporte (DSE)** | Media–alta | Diseñar e implementar XML/CUDS y flujo de emisión de DSE (comprador, no obligado). |
| 2 | **PDF: forma y medio de pago** | Alta | Incluir forma y medio de pago en la representación gráfica y validar con anexo. |
| 3 | **POS consumidor final** | Media | Asegurar que se pueda emitir POS sin NIT del cliente (o con valor “consumidor final”) y que XML/PDF sigan válidos. |
| 4 | **Envío de factura por correo** | Media | Módulo de envío de factura/PDF por email al cliente (opcional para DIAN, útil comercialmente). |
| 5 | **PaymentMeans en XML** | Media | Revisar anexo 1.9; si es obligatorio, añadir `cac:PaymentMeans` en Invoice/NC/ND/POS. |
| 6 | **Consulta estado en DIAN** | Baja | Opcional: integración con GetStatusZip o equivalente para consultar estado en la DIAN. |
| 7 | **Pruebas formales de habilitación** | Alta | Ejecutar en ambiente de habilitación DIAN las pruebas que exigen (facturas, NC, ND, POS) y completar el proceso de habilitación. |

---

## Conclusión

- **Facturación electrónica de venta, Nota Crédito, Nota Débito y POS** están cubiertas a nivel de estándar UBL 2.1, CUFE, firma, envío y representación gráfica, alineadas con lo que pide la DIAN.
- Para **cerrar brechas frente a la DIAN** y acercarse a lo que hacen Siigo/Alegra, lo más importante es: **(1)** afinar la representación gráfica (forma/medio de pago, denominación, número de autorización), **(2)** validar POS consumidor final, **(3)** revisar obligatoriedad de PaymentMeans en XML según anexo 1.9 y **(4)** si el negocio lo requiere, añadir **Documento Soporte (DSE)** y **envío de factura por correo**.

Este documento debe leerse junto con la normativa oficial (Anexo Técnico v1.9 y resoluciones vigentes) y, en su caso, con la documentación del Proveedor Tecnológico si se usa uno.
