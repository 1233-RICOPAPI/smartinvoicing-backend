# Análisis del proyecto MottaTech (MYR SMARTINVOICING)

## Resumen ejecutivo

El software cubre facturación electrónica DIAN, POS, inventarios, contabilidad automatizada, reportes, planes y pagos con Mercado Pago. A continuación: lo que está bien, lo que falta, errores a corregir y flujos a mejorar.

---

## 1. Lo que está bien resuelto

- **Auth y multi-tenant**: JWT, roles (Owner, Contador, Cajero, etc.), CompanyAccessGuard, cambio de empresa.
- **Facturación ELC**: XML UBL 2.1, CUFE, QR, firma digital, envío DIAN, estados (creada, firmada, enviada, aceptada, rechazada).
- **Notas crédito/débito**: Builders UBL y flujo en DianService.
- **Contabilidad**: Partida doble automática al facturar, PUC, asientos manuales, reportes (Balance, P&G, auxiliar).
- **Inventarios**: Movimientos, kardex, alertas de stock (modelo y servicios).
- **Planes y suscripciones**: Emprender 30k, Profesional 70k, Empresarial 300k; período y días restantes.
- **Mercado Pago**: Preferencias, webhook, extensión de período al aprobar pago.
- **Modo Developer**: API keys hasheadas, validación por empresa y plan, endpoint público para crear factura con X-API-Key.
- **Export**: Excel/PDF por tipo de reporte, PDF de factura; mensajes de error útiles en frontend.
- **Copilot IA**: Intents, motor de consultas sobre BD, caché, respuestas controladas; ahora blindado ante preguntas sin datos y con opción Gemini.

---

## 2. Errores y riesgos a corregir

### Backend

| Área | Problema | Acción sugerida |
|------|----------|------------------|
| **Clients** | `personType` por defecto en backend es `'Jurídica'` si no se envía; front envía `'Natural'`. | Ya alineado; verificar que create/update reciban y persistan bien. |
| **Export** | Balance/P&G pueden fallar si la empresa no tiene cuentas contables (PUC) inicializadas. | Inicializar PUC por defecto al crear empresa o al primer uso de contabilidad; o devolver mensaje claro "Configure el plan de cuentas". |
| **Payments** | Webhook no valida firma HMAC si `MERCADOPAGO_WEBHOOK_SECRET` no está. | Implementar validación cuando el secret esté definido; si no, log de advertencia. |
| **DIAN** | Si `DianConfig` no existe o falta certificado, buildAndSign o send fallan con mensaje genérico. | Mensajes BadRequest más claros: "Configure certificado DIAN" / "Configure clave técnica". |
| **Subscription** | Uso de `(this.prisma as any).subscription` por compatibilidad con cliente Prisma. | Tras asegurar que `prisma generate` incluye Subscription, usar `this.prisma.subscription` y quitar casts. |
| **MongoDB** | Con `SKIP_MONGODB=1` no hay DIAN (DianModule depende de Mongo para historial). | Aceptable para dev; en producción no usar SKIP_MONGODB. |

### Frontend

| Área | Problema | Acción sugerida |
|------|----------|------------------|
| **API base** | `API_BASE = process.env.NEXT_PUBLIC_API_URL \|\| '/api'` puede apuntar a proxy o a backend directo. | Definir en .env del frontend `NEXT_PUBLIC_API_URL=http://localhost:8080` en dev y la URL real en prod. |
| **Export** | Libro auxiliar requiere código de cuenta; si el usuario no tiene PUC cargado, no sabe qué poner. | En la UI, selector de cuenta (lista de cuentas de la empresa) o enlace a "Configurar plan de cuentas". |
| **Facturas** | getXml puede fallar si la factura no está firmada. | Mostrar mensaje claro: "Primero firme y envíe la factura a la DIAN". |

---

## 3. Flujos a mejorar

### 3.1 Onboarding de empresa

- **Hoy**: Registro crea empresa, usuario owner y suscripción por defecto.
- **Falta**: Asistente o pasos para: (1) Configurar DIAN (clave técnica, certificado, ambiente), (2) Cargar o generar PUC inicial, (3) Resolución de facturación (rangos).

### 3.2 Configuración DIAN por empresa

- **Hoy**: DianConfig en BD; no hay pantalla de administración en el frontend.
- **Falta**: Página "Configuración DIAN" (o en Ajustes): ambiente, clave técnica, subida de certificado .p12, prefijos FE/POS, número desde-hasta. Llamar a backend que actualice DianConfig.

### 3.3 Plan de cuentas (PUC)

- **Hoy**: AccountingAccount existe; CompanyAccountMapping para claves (CLIENTES_NACIONALES, IVA_GENERADO, etc.). No hay UI para crear/editar cuentas ni mapeos.
- **Falta**: CRUD de cuentas PUC por empresa y pantalla de mapeo (qué cuenta usa para clientes, IVA, etc.) para que contabilidad y reportes no fallen.

### 3.4 Resoluciones de facturación

- **Hoy**: DianResolution en schema; DianResolutionService existe.
- **Falta**: UI para crear/editar resoluciones (prefijo, rango, fechas) y que al crear factura se use el rango activo.

### 3.5 Facturación de compras (proveedores)

- **Hoy**: Modelo Supplier; no hay módulo de "facturas de compra" ni asientos de IVA descontable desde compras.
- **Falta**: Si el negocio lo requiere: entidad PurchaseInvoice, carga de XML o datos de factura de proveedor, e integración con contabilidad (cuentas por pagar, IVA descontable).

### 3.6 Notas crédito/débito desde la UI

- **Hoy**: Backend (DianService) puede construir y firmar NC/ND.
- **Falta**: En frontend, desde el detalle de una factura, botón "Emitir nota crédito" / "Nota débito" con motivo y líneas; llamar a endpoints que creen el documento y lo envíen a la DIAN.

### 3.7 Cierre de caja (POS)

- **Hoy**: PosSession, apertura/cierre; ventas asociadas a sesión.
- **Falta**: Pantalla de cierre de caja (resumen de ventas, efectivo esperado vs contado, diferencia) y posible arqueo.

### 3.8 Suscripción recurrente automática

- **Hoy**: Pago único por período (mensual/anual); al vencer se renueva manualmente.
- **Falta**: Si se desea cobro automático cada mes: integrar Mercado Pago Subscriptions (o cron que cree preferencia y notifique al usuario) y marcar suscripción como recurrente.

### 3.9 Cancelar / bajar de plan

- **Hoy**: No hay "cancelar suscripción" ni "bajar a plan más bajo".
- **Falta**: Endpoint y UI: "No renovar" (al vencimiento no extender) y "Cambiar a plan X" (a partir del próximo período).

---

## 4. Implementaciones recomendadas (prioridad)

### Alta

1. **Configuración DIAN en frontend**: formulario que persista en DianConfig (clave técnica, certificado, prefijos, ambiente).
2. **Inicialización de PUC**: al crear empresa o al entrar por primera vez a Contabilidad, crear cuentas mínimas (o importar PUC estándar Colombia) y mapeos por defecto.
3. **Validación de webhook Mercado Pago**: comprobar firma cuando `MERCADOPAGO_WEBHOOK_SECRET` esté definido.

### Media

4. **Resoluciones de facturación**: CRUD en backend (ya hay modelo y servicio); pantalla en frontend.
5. **Notas crédito/débito desde UI**: flujo en detalle de factura + endpoints que usen DianService.
6. **Selector de cuenta en Export**: para libro auxiliar, listar cuentas de la empresa en un dropdown.

### Baja

7. **Gemini en Copilot**: con `GEMINI_API_KEY` en .env, implementar en `GeminiFallbackService.ask()` la llamada real a la API (p. ej. `@google/generative-ai`) para preguntas UNKNOWN/EXPLAIN.
8. **Cierre de caja POS**: pantalla de cierre con totales y diferencia.
9. **Facturas de compra**: si aplica al negocio, módulo de compras y enlace contable.

---

## 5. Seguridad y producción

- **CORS**: En producción usar `CORS_ORIGIN` con el dominio del frontend, no `*`.
- **JWT**: Secret fuerte y rotación; `JWT_EXPIRES_IN` razonable (ej. 7d).
- **Certificado DIAN**: No subir .p12 al repo; subir cifrado o usar secret manager (Cloud Run Secret Manager).
- **API keys (Developer)**: Ya se guardan hasheadas; no exponer la key completa después de crear.
- **Rate limiting**: Considerar límite por IP o por companyId en endpoints públicos (login, webhook, developer/invoice-request).

---

## 6. Testing y calidad

- **Backend**: Hay specs en accounting, audit, AI, dian, invoicing; ampliar a controllers y servicios críticos (invoices, dian, payments).
- **E2E**: Revisar que los tests e2e pasen con la estructura actual de módulos.
- **Frontend**: Pruebas manuales o con Playwright/Cypress en flujos: registro, login, crear cliente, producto, factura, firmar/enviar DIAN, exportar, plan y pago.

---

## 7. Checklist rápido antes de producción

- [ ] Variables de entorno documentadas y configuradas (DB, Mongo, JWT, DIAN, Mercado Pago, CORS, API_URL).
- [ ] PUC inicial por empresa o guía de configuración.
- [ ] Configuración DIAN (certificado, clave técnica, resoluciones) por empresa.
- [ ] Webhook Mercado Pago con HTTPS y validación de firma.
- [ ] No usar `SKIP_MONGODB` en producción.
- [ ] Logs y monitoreo (Cloud Logging en Cloud Run).
- [ ] Backups de PostgreSQL (Neon) y MongoDB (Atlas) verificados.

---

*Documento generado a partir del análisis del código; conviene revisarlo con el equipo y priorizar según el roadmap.*
