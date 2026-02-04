# MottaTech – Flujo POS → Inventario → Contabilidad y Snapshots

## 1. Flujo POS (diagrama lógico)

```
[Cliente / Cajero]  →  POST /pos/sale (items + payments)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Validar ítems y stock (ProductWarehouse)                     │
│    Si stock insuficiente → 400 Bad Request                       │
├─────────────────────────────────────────────────────────────────┤
│ 2. Validar suma de pagos = total                                │
├─────────────────────────────────────────────────────────────────┤
│ 3. Obtener sesión POS abierta (posSessionId o última OPEN)      │
├─────────────────────────────────────────────────────────────────┤
│ 4. Dentro de UNA transacción PostgreSQL:                        │
│    a) Crear Invoice (FACTURA_POS) + InvoiceItem + InvoiceTax   │
│    b) Por cada ítem con inventario:                             │
│       - Crear InventoryMovement (SALIDA)                         │
│       - Decrementar ProductWarehouse.quantity                    │
│    c) Crear InvoicePayment por cada medio de pago                │
│    d) Generar asiento contable y persistir (misma tx)           │
│       - Débito: Caja (total)                                    │
│       - Crédito: Ingresos (subtotal)                            │
│       - Crédito: IVA generado (taxAmount)                       │
│       - Débito: Costo de venta (costOfGoodsSold)                │
│       - Crédito: Inventario (costOfGoodsSold)                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
  Respuesta: Invoice con items, payments (trazabilidad completa)
```

## 2. Modelos PostgreSQL implicados

| Tabla                 | Uso en POS |
|-----------------------|------------|
| **Invoice**           | Documento de venta (type = FACTURA_POS), posSessionId opcional |
| **InvoiceItem**       | Líneas de la venta (producto, cantidad, precio, IVA) |
| **InvoicePayment**    | Medios de pago (method: EFECTIVO, TARJETA, TRANSFERENCIA, amount) |
| **PosSession**        | Sesión de caja (openedAt, closedAt, openingCash, closingCash, status OPEN/CLOSED) |
| **InventoryMovement**| SALIDA por producto, reference = número factura, referenceId = invoiceId |
| **ProductWarehouse**  | Stock actualizado (quantity decrementada) |
| **AccountingJournalEntry** | Cabecera del asiento POS |
| **AccountingEntry**  | Líneas del asiento (Caja, Ingresos, IVA, Costo venta, Inventario) |

## 3. Snapshots contables mensuales (MongoDB)

- **Fuente de verdad:** PostgreSQL (asientos en AccountingEntry).
- **MongoDB:** Solo agregados; colección `accounting_snapshots`.

### Flujo de datos (snapshots)

1. **Generar snapshot**  
   `POST /snapshots/monthly/:year/:month`  
   - Lee de PostgreSQL todos los `AccountingEntry` con `date <= último día del mes`.  
   - Agrupa por cuenta y tipo (Activo, Pasivo, Patrimonio, Ingreso, Costo, Gasto).  
   - Calcula saldos por naturaleza (débito/crédito).  
   - Arma `balanceSheet`, `incomeStatement`, `accountsSummary`.  
   - Inserta o actualiza en MongoDB solo si el mes no está cerrado (`status !== CLOSED`).

2. **Cerrar mes**  
   `POST /snapshots/monthly/:year/:month/close`  
   - Pone `status = CLOSED` y `closedAt = now()`.  
   - A partir de ahí no se puede reprocesar ese mes.

3. **Consultar**  
   `GET /snapshots/monthly/:year/:month`  
   - Devuelve el snapshot desde MongoDB (para reportes/analítica).

### Esquema MongoDB (accounting_snapshots)

- `companyId`, `year`, `month` (índice único).  
- `status`: OPEN | CLOSED.  
- `generatedAt`, `closedAt`.  
- `balanceSheet`: activos, pasivos, patrimonio, valid.  
- `incomeStatement`: ingresos, costos, gastos, utilidades.  
- `accountsSummary`: lista de cuentas con saldo.  
- `periodStart`, `periodEnd`.

## 4. Validaciones críticas

- **Stock:** No se vende si `ProductWarehouse.quantity` < cantidad pedida (por producto con inventario).  
- **Pagos:** `sum(payments.amount)` debe ser igual al total de la factura (tolerancia 0.02).  
- **Partida doble:** Débitos = Créditos antes de persistir el asiento.  
- **Sesión POS:** Debe existir una `PosSession` con `status = OPEN` (o enviar `posSessionId`).  
- **Almacén:** Debe existir un `Warehouse` con `isDefault = true` para movimientos de inventario.

## 5. Errores comunes a evitar

- No registrar venta sin validar stock (inconsistencia inventario/ventas).  
- No persistir asiento en otra transacción que la de la factura e inventario (riesgo de factura sin asiento o asiento huérfano).  
- No recalcular ni reemplazar snapshots con `status = CLOSED`.  
- No usar MongoDB como fuente de verdad de asientos; solo para reportes y snapshots.  
- Asegurar que el cliente POS (ej. “Consumidor final”) exista y que la empresa tenga mapeo de cuentas (CAJA, INGRESOS_VENTAS, IVA_GENERADO, COSTOS_MERCANCIAS, INVENTARIO) en `CompanyAccountMapping`.
