# Requisitos para software de facturación electrónica (ELC) en Colombia – DIAN

## Resumen de cumplimiento MYR SMARTINVOICING

| Requisito | Cumplimiento |
|-----------|--------------|
| RUT actualizado (empresa y representantes) | **Usuario** – El software no valida RUT; la empresa debe tenerlo al día en la DIAN. |
| Certificado de firma digital (ONAC) | **Sí** – Firma digital con certificado .p12 (DIAN_CERT_PATH, DIAN_CERT_PASSWORD). |
| Correo electrónico en RUT | **Usuario** – Configuración en DIAN; el software envía a la API. |
| Estándar UBL 2.1 | **Sí** – XML generado según Anexo Técnico (factura, nota crédito, nota débito). |
| CUFE (Código Único) | **Sí** – Generado con SHA-384 según fórmula DIAN. |
| Código QR | **Sí** – Incluye NIT emisor/receptor, CUFE, fecha, valor total. |
| Integración con API DIAN | **Sí** – Envío y recepción de respuestas (habilitación/producción). |
| Instrumento de Firma Electrónica (IFE) | **Usuario** – Habilitación de rangos en portal DIAN. |

---

## Requisitos previos (según DIAN)

1. **RUT actualizado** de la empresa y representantes legales.
2. **Acceso al correo** registrado en el RUT (para token y notificaciones).
3. **Certificado de firma digital** autorizado por la ONAC.
4. **Dispositivo con internet** (computador, tablet o celular).
5. **IFE** (Instrumento de Firma Electrónica) habilitado para autorizar rangos de numeración.

---

## Requisitos técnicos del software

- **Formato**: Documentos en **XML bajo estándar UBL 2.1** (Anexo Técnico DIAN).
- **CUFE**: Código único por documento (hash SHA-384 con reglas del Anexo).
- **Representación gráfica**: PDF con código QR que permita validar la factura.
- **Firma digital**: Firma del XML antes del envío (certificado X.509).
- **Notas crédito/débito**: Mismo estándar UBL, con referencia a la factura original (BillingReference).

---

## Qué falta o depende del usuario

- **Registro como facturador electrónico** en el portal de la DIAN (habilitación, token, rangos).
- **Certificado digital** (.p12) y contraseña en variables de entorno.
- **Credenciales DIAN** (client_id / client_secret o proveedor tecnológico) en .env.
- **Cálculo de impuestos** (IVA 5%/19%, Impoconsumo, retenciones) – el backend ya soporta lógica de impuestos y retenciones en asientos contables.

---

## Referencias

- [Sistema de facturación electrónica – DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/)
- [Requerimientos para ser facturador electrónico](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/requerimientos-para-ser-facturador-electronico/)
- [Documentación técnica DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/)
- Anexo Técnico Resolución 000012 (UBL 2.1, CUFE, validaciones).
