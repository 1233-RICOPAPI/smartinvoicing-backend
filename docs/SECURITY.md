# Seguridad – MYR SMARTINVOICING (Backend)

## TLS 1.3 y HTTPS

- **Tránsito**: Toda la API y el front deben servirse por **HTTPS**. En Cloud Run / carga frontal (Load Balancer, Cloudflare, etc.) se termina TLS; configurar **TLS 1.2 mínimo y preferir TLS 1.3** donde el proveedor lo permita.
- **Backend**: No exponer el backend directamente a internet; ponerlo detrás de un proxy que maneje TLS (Cloud Run ya usa HTTPS).
- **Frontend**: `NEXT_PUBLIC_API_URL` en producción debe ser `https://...`. No enviar credenciales ni tokens por HTTP.

## JWT

- **JWT_SECRET**: En producción usar un secreto de al menos 32 caracteres aleatorios (por ejemplo `openssl rand -base64 32`). No reutilizar entre entornos.
- **JWT_EXPIRES_IN**: 7d por defecto; para mayor seguridad en pasarela de pago o acciones sensibles se puede usar un tiempo menor o refresh tokens.
- **Almacenamiento en front**: Guardar el token en memoria cuando sea posible; si se usa `localStorage`, asumir que es accesible por XSS (por eso es crítico CSP y sanitización).
- **Header**: Siempre enviar `Authorization: Bearer <token>` y `X-Company-Id` en las peticiones autenticadas. No enviar el token en query params ni en cookies no seguras.

## Pasarela de pago (Mercado Pago)

- **Access Token**: Solo en backend (`.env`). Nunca exponer en el front ni en el cliente.
- **Clave pública**: La `MERCADOPAGO_PUBLIC_KEY` puede ir en el front para el checkout; la clave privada/access token no.
- **Webhooks**: Validar siempre la firma (`x-signature` / `MERCADOPAGO_WEBHOOK_SECRET`) antes de procesar notificaciones. Servir el endpoint por HTTPS.
- **Idempotencia**: Ante reintentos del webhook, comprobar si el pago ya fue procesado (por `external_id` o similar) para no duplicar facturas ni asientos.

## Modo Developer (API keys)

- Las API keys se guardan hasheadas (SHA-256); la key en claro solo se muestra una vez al crearla.
- Usar el header **X-API-Key** para `POST /developer/invoice-request`; no enviar la key en query ni en el body.
- Exponer el endpoint solo por HTTPS (TLS 1.3 recomendado) para evitar robo de la key en tránsito.
- Rotar keys si hay sospecha de compromiso; revocar desde el dashboard (DELETE `/developer/api-keys/:id`).

## Headers de seguridad (Helmet)

- La API usa Helmet para enviar, entre otros: `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security` (HSTS en producción), etc.
- En producción se habilita Content-Security-Policy según necesidad (por ejemplo si se sirve HTML desde la API).

## CORS

- En producción configurar `CORS_ORIGIN` con los dominios concretos del front (por ejemplo `https://app.myrsmartinvoicing.com`). Evitar `*` con credenciales.

## Resumen de buenas prácticas

| Área           | Práctica |
|----------------|----------|
| Red            | HTTPS y TLS 1.3 donde sea posible |
| JWT            | Secreto fuerte, expiración, en header Bearer |
| Pagos          | Token solo en backend; validar firma webhook |
| API keys       | Hash en DB; key en header; HTTPS obligatorio |
| CORS           | Orígenes explícitos en producción |
| Helmet         | Headers de seguridad activos |
