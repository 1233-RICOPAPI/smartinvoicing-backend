# Brechas para certificación DIAN y checklist MottaTech

Resumen de lo **ya implementado** y lo que **falta** según el checklist previo a certificación.

---

## 1️⃣ Facturación electrónica

| Requisito | Estado | Notas |
|-----------|--------|--------|
| **CUFE** con campos obligatorios + opcionales | ✅ Implementado | `CufeService` (modules/invoicing) con `generateCufeExtended`: número, fecha, hora, base, impuesto, total, NITs, clave técnica, opcionales softwareId, documentTypeCode, environmentCode. |
| **Validación explícita del cálculo CUFE** | ⚠️ Parcial | No hay tests unitarios que validen el CUFE con todos los campos; solo uso en flujo. |
| **Firma XAdES** con .p12 para Factura y POS | ✅ Implementado | `SignerService.signXml()` (XAdES-BES) en `dian.service.buildAndSignInvoice`. |
| **Firma para Nota Crédito / Nota Débito** | ❌ Falta | Solo se construye y firma XML tipo **Invoice** (UBL Invoice-2). NC/ND requieren UBL **CreditNote** y **DebitNote** (esquemas distintos). Códigos CUFE 91/92 existen en `dian/cufe/cufe.service` pero no hay builders UBL ni flujo de firma para NC/ND. |
| **DianResolutionService** (prefijos, rangos, vigencias) | ✅ Implementado | `getNextNumber`, `validateNumber`, `getActiveResolution` por tipo (FACTURA_VENTA, FACTURA_POS, NOTA_CREDITO, NOTA_DEBITO). |
| **DianApiService** token OAuth2 | ✅ Implementado | Token en memoria, TTL 50 min, `getToken()` + `sendDocument()`. |
| **DianResponseHandler** + retry máx. 3 | ✅ Implementado | `FacturaStatusTracker.retrySend` con `MAX_RETRIES = 3`; handler actualiza Invoice, DianDocument, DianEvent. |
| **Estado en Invoice + DianDocument + DianEvent** | ✅ Implementado | Handler actualiza los tres en transacción. |
| **dian_history en MongoDB** | ✅ Implementado | `DianResponseHandler` persiste cada envío/respuesta en `dian_history`. |

**Falta (resumen 1):**
- Tests unitarios que validen el **cálculo del CUFE** (campos obligatorios y opcionales).
- **UBL y flujo** para **Nota Crédito** y **Nota Débito** (builders + firma + envío) si la certificación los exige.

---

## 2️⃣ Contabilidad y snapshots

| Requisito | Estado | Notas |
|-----------|--------|--------|
| Asientos partida doble (Factura, POS, NC, ND, Compras) | ✅ Implementado | `AccountingEngineService` con `AccountingDocumentType` para todos. |
| Retenciones (IVA, ICA, Fuente) en asientos | ✅ Implementado | `GenerateEntryDto` con retentionSource, retentionIca, retentionIva; cuentas RETENCION_* en mapeo. |
| Snapshots mensuales (accounting_snapshots) | ✅ Implementado | `SnapshotGenerationService` + schema en MongoDB. |
| Cierre de mes (CloseMonthService) | ✅ Implementado | `closeMonth`, `getStatus` en snapshots. |
| Reportes (Balance, Estado Resultados, Libro Auxiliar) | ✅ Implementado | Servicios en reports + export. |

**Falta (resumen 2):** Nada crítico; opcional: tests unitarios para `AccountingEngineService` (partida doble y retenciones).

---

## 3️⃣ POS y ventas

| Requisito | Estado | Notas |
|-----------|--------|--------|
| PosSaleService: stock, Invoice POS, inventario, asientos | ✅ Implementado | Flujo en `pos-sale.service` con `DianResolutionService` para numeración. |
| **Pruebas completas de PosSaleService** | ❌ Falta | No hay tests unitarios ni e2e que cubran validación de stock, creación de factura, movimientos y asientos. |

**Falta (resumen 3):** Unit y/o e2e tests para el flujo POS completo.

---

## 4️⃣ Auditoría y trazabilidad

| Requisito | Estado | Notas |
|-----------|--------|--------|
| AuditService para acciones críticas | ✅ Implementado | `AuditService.log`; `DianAuditService.logDianAction` en envíos, reintentos y ajustes contables. |
| Trazabilidad Invoice → DianEvent → Snapshot → AuditLogs | ✅ Implementado | `getDianHistory` agrega eventos PG + dian_history + audit_logs. |
| GET /audit/dian/:invoiceId/history | ✅ Implementado | Con RolesGuard AUDITOR/CONTADOR. |
| Export PDF/Excel del historial | ✅ Implementado | GET /audit/dian/:invoiceId/export?format=pdf|excel. |

**Falta (resumen 4):** Nada crítico; opcional: e2e del endpoint de auditoría.

---

## 5️⃣ IA contable y explicativa

| Requisito | Estado | Notas |
|-----------|--------|--------|
| CopilotService (IVA, retenciones, anomalías, balances) | ✅ Implementado | Intents TAX_IVA_DUE, TAX_RETENTIONS_BY_INVOICE, TAX_INSISTENCIES_SANCTIONS, etc. |
| QueryEngineService sin SQL libre | ✅ Implementado | Solo servicios existentes. |
| ReasoningService en lenguaje natural | ✅ Implementado | Formatos por intent. |
| Cache consultas (copilot_cache) | ✅ Implementado | Por hash de consulta en MongoDB. |

**Falta (resumen 5):** Tests unitarios para `CopilotService` y `QueryEngineService` (al menos los intents fiscales).

---

## 6️⃣ Exportación

| Requisito | Estado | Notas |
|-----------|--------|--------|
| PDF/Excel reportes contables y auditoría | ✅ Implementado | Export controller: excel, pdf, export historial DIAN. |
| Representación visual facturas con QR DIAN | ✅ Implementado | `InvoicePdfExportService` / `PdfGeneratorService` + GET /export/invoice/:id/pdf. |
| Filtrado por fechas, cuentas, usuarios | ✅ Implementado | Query params en export y reportes. |

**Falta (resumen 6):** Nada crítico.

---

## 7️⃣ Seguridad y multi-tenant

| Requisito | Estado | Notas |
|-----------|--------|--------|
| JwtAuthGuard en endpoints críticos | ✅ Implementado | Controllers de dian, accounting, export, audit, ai, pos, reports, etc. |
| CompanyAccessGuard | ⚠️ Parcial | Solo en **audit** y **auth** (switch company). Resto de controllers no lo usan; si el token ya trae `companyId` y no se permite override, puede ser aceptable. Revisar si DIAN exige validación explícita de empresa en cada request. |
| RolesGuard (AUDITOR, CONTADOR donde aplica) | ✅ Implementado | Audit y AI/Copilot. |
| CompanyUser multi-empresa | ✅ Implementado | Prisma + JWT con currentCompanyId. |
| SuperAdmin | ✅ Implementado | RolesGuard y CompanyAccessGuard lo contemplan. |

**Falta (resumen 7):** Decidir si añadir `CompanyAccessGuard` (y/o validación de `X-Company-Id`) en más controllers para alineación con auditoría y multi-tenant estricto.

---

## 8️⃣ Testing backend (obligatorio antes de certificación)

| Requisito | Estado | Notas |
|-----------|--------|--------|
| Unit: DianApiService | ❌ Falta | Mock de ConfigService y fetch; tests de getToken (cache, fallo) y sendDocument. |
| Unit: DianResponseHandler | ❌ Falta | Mock Prisma + DianHistory; validar actualización Invoice/DianDocument/DianEvent y escritura en dian_history. |
| Unit: DianAuditService | ✅ Hecho | logDianAction y constantes. |
| Unit: AccountingEngineService | ❌ Falta | Generación de asientos por tipo de documento y con retenciones. |
| Unit: CopilotService | ❌ Falta | Flujo query (intent, cache, reasoning). |
| E2E: POST /dian/invoices/:id/emit-pos-electronic | ❌ Falta | No existe suite e2e en el proyecto. |
| E2E: GET /audit/dian/:invoiceId/history | ❌ Falta | Idem. |
| E2E: POST /ai/copilot/query | ❌ Falta | Idem. |
| Escenarios: errores DIAN, facturas duplicadas, ajustes contables | ❌ Falta | Sin tests que simulen rechazo DIAN, duplicados o ajustes. |

**Falta (resumen 8):**
- **Unit tests:** DianApiService, DianResponseHandler, AccountingEngineService, CopilotService (y opcional CufeService para CUFE).
- **E2E:** Crear proyecto e2e (NestJS TestingModule + supertest o similar) y al menos 3 tests: emit-pos-electronic, audit/dian/:id/history, ai/copilot/query.
- **Escenarios críticos:** Tests que simulen respuesta DIAN rechazada, factura duplicada (reglas de anomalías) y persist de asiento con documentId (auditoría).

---

## Resumen ejecutivo: qué falta

1. **Tests obligatorios**
   - Unit: **DianApiService**, **DianResponseHandler**, **AccountingEngineService**, **CopilotService** (y opcional **CufeService** para CUFE).
   - E2E: configuración de **e2e** y tests para **emit-pos-electronic**, **audit/dian/:invoiceId/history**, **ai/copilot/query**.
   - Escenarios: **rechazo DIAN**, **factura duplicada**, **ajuste contable** (auditoría).

2. **Facturación electrónica (si aplica certificación con NC/ND)**
   - Builders UBL **CreditNote** y **DebitNote** y flujo de firma + envío para Nota Crédito y Nota Débito.

3. **Validación CUFE**
   - Al menos un test unitario que verifique el CUFE con todos los campos obligatorios y opcionales según anexo técnico.

4. **Seguridad (recomendado)**
   - Valorar uso de **CompanyAccessGuard** (o validación explícita de empresa) en controllers críticos (dian, accounting, export, etc.) si la certificación lo requiere.

Orden sugerido: primero **tests unitarios** de los 4 servicios indicados y **e2e** de los 3 endpoints; luego CUFE y, si aplica, UBL NC/ND y refuerzo de guards.
