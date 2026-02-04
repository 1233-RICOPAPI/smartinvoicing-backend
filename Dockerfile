# Google Cloud Run - MottaTech API (NestJS)
# Imagen base
FROM node:20-alpine

WORKDIR /app

# Dependencias: primero solo package para aprovechar caché de capas
COPY package.json package-lock.json* ./

# Instalar dependencias (incluye devDependencies para poder compilar)
RUN npm ci

# Copiar el resto del código (Prisma, src, etc.)
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Compilar la aplicación
RUN npm run build

# Puerto expuesto (Cloud Run usa PORT)
EXPOSE 8080

# Ejecutar la app compilada
CMD ["node", "dist/main.js"]
