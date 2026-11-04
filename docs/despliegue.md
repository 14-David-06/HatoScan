# Despliegue a producción

Arquitectura (ADR 0006): dos proyectos de Vercel sobre este repo (web y detector) y un bucket S3
privado para las fotos y los JSON. Airtable guarda los conteos y los usuarios.

```
Navegador ──PUT firmado──▶ S3 (privado)
    │                         ▲   ▲
    ▼                         │   │ GET firmado
Vercel: apps/web ──HTTP + token──▶ Vercel: services/detector ──▶ Claude / OpenAI
    │
    └──▶ Airtable (Conteos, Usuarios)
```

Los pasos de Vercel se hacen en el dashboard; no se usa la CLI de Vercel.

## 0. Requisitos

- Un equipo de **Vercel Pro**. Hobby no permite uso comercial y su límite de 300 s por función se
  queda corto para la detección.
- Acceso a la cuenta de AWS de Sirius Regenerative con permisos sobre S3 e IAM.
- Los IDs de la base de Airtable de HatoScan y de las tablas `Usuarios` y `Conteos`, y un token
  de Airtable con lectura y escritura en esa base.
- Llaves de Anthropic (y de OpenAI, si se ofrecen sus métodos).
- La rama que se va a desplegar, ya integrada en la rama de producción del repo (ver paso 4).

Elige ahora el nombre del proyecto web en Vercel. Su dominio será `https://<nombre>.vercel.app`
y hace falta para el CORS del bucket. En este documento se usa `hatoscan`.

## 1. Bucket S3

### Opción A: script (recomendada)

Con la AWS CLI y una sesión en la cuenta de Sirius (`aws login` o `aws sso login`):

```sh
sh infra/aws/setup-s3.sh sirius-hatoscan-prod us-east-1 https://hatoscan.vercel.app
```

El script:

- Crea el bucket privado, con Block Public Access, cifrado SSE-S3 y una política que solo acepta
  HTTPS.
- Configura el CORS para el origen de la app.
- Agrega la regla que borra `uploads/` a las 24 h.
- Crea el usuario IAM `hatoscan-web` con permisos solo sobre ese bucket.
- Imprime su llave **una sola vez**. Cópiala directo a Vercel (paso 3).

Se puede volver a ejecutar, por ejemplo para cambiar el origen del CORS al pasar a un dominio
propio. No crea llaves nuevas si el usuario ya tiene una.

### Opción B: consola de AWS

1. **S3 → Create bucket**:
   - Nombre: `sirius-hatoscan-prod`. Región: `us-east-1`.
   - Object Ownership: _ACLs disabled_.
   - _Block all public access_: activado.
   - Cifrado: SSE-S3.
2. En el bucket, **Permissions**:
   - _Bucket policy_: pega [`infra/aws/bucket-policy.json`](../infra/aws/bucket-policy.json)
     cambiando `__BUCKET__` por el nombre del bucket.
   - _CORS_: pega [`infra/aws/cors.json`](../infra/aws/cors.json) cambiando `__APP_ORIGIN__` por
     `https://hatoscan.vercel.app`. Si hay dominio propio, agrégalo a `AllowedOrigins`.
3. **Management → Lifecycle rule**:
   - Prefijo: `uploads/`.
   - _Expire current versions_ a 1 día.
   - _Delete incomplete multipart uploads_ a 1 día.
4. **IAM → Users → Create user** `hatoscan-web`, sin acceso a la consola. Luego:
   - _Add permissions → Create inline policy_ → JSON: pega
     [`infra/aws/web-user-policy.json`](../infra/aws/web-user-policy.json) con el nombre del
     bucket.
   - _Security credentials → Create access key_, del tipo _Application running outside AWS_.

## 2. Proyecto del detector en Vercel

1. **Add New → Project**. Importa el repo y configura:
   - _Root Directory_: `services/detector`. Vercel detecta FastAPI en `app/main.py`.
   - Build y output: los valores por defecto.
   - Nombre: `hatoscan-detector`.
2. **Environment Variables** (Production):

   | Variable                       | Valor                                                                                                   |
   | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
   | `DETECTOR_API_TOKEN`           | Cadena aleatoria de 64 caracteres hex (`node -e "console.log(crypto.randomBytes(32).toString('hex'))"`) |
   | `DETECTOR_ALLOWED_IMAGE_HOSTS` | `["sirius-hatoscan-prod.s3.us-east-1.amazonaws.com"]`                                                   |
   | `DETECTOR_DEFAULT_DETECTOR`    | `claude-vision`                                                                                         |
   | `DETECTOR_ENABLED_DETECTORS`   | `["claude-vision","claude-vision-sonnet","openai-vision","openai-vision-sol"]`                          |
   | `ANTHROPIC_API_KEY`            | Llave de Anthropic                                                                                      |
   | `OPENAI_API_KEY`               | Llave de OpenAI (opcional)                                                                              |

3. **Settings → Functions**:
   - _Fluid compute_: activado.
   - _Function CPU_: _Performance_ (2 vCPU, 4 GB).
   - Región: `iad1` (Washington, junto a `us-east-1`).
4. **Deploy**. Comprueba que `https://hatoscan-detector.vercel.app/health` responda `{"status":"ok"}`.

## 3. Proyecto web en Vercel

1. **Add New → Project**. Mismo repo, y configura:
   - _Root Directory_: `apps/web`.
   - Framework: Next.js.
   - Nombre: `hatoscan`.

   Vercel instala desde la raíz del monorepo (workspaces de npm).

2. **Environment Variables** (Production):

   | Variable                     | Valor                                           |
   | ---------------------------- | ----------------------------------------------- |
   | `STORAGE_DRIVER`             | `s3`                                            |
   | `S3_BUCKET`                  | `sirius-hatoscan-prod`                          |
   | `S3_REGION`                  | `us-east-1`                                     |
   | `S3_ACCESS_KEY_ID`           | Llave de `hatoscan-web`                         |
   | `S3_SECRET_ACCESS_KEY`       | Secreto de `hatoscan-web` (márcala _Sensitive_) |
   | `DETECTOR_BASE_URL`          | `https://hatoscan-detector.vercel.app`          |
   | `DETECTOR_API_TOKEN`         | La misma cadena del detector                    |
   | `DETECTOR_TIMEOUT_MS`        | `780000`                                        |
   | `APP_BASE_URL`               | `https://hatoscan.vercel.app`                   |
   | `AUTH_SESSION_SECRET`        | Otra cadena aleatoria de 64 caracteres hex      |
   | `AIRTABLE_API_TOKEN`         | Token de Airtable                               |
   | `AIRTABLE_BASE_ID`           | `app…`                                          |
   | `AIRTABLE_USUARIOS_TABLE_ID` | `tbl…`                                          |
   | `AIRTABLE_CONTEOS_TABLE_ID`  | `tbl…` (obligatoria con `s3`)                   |

   Marca como _Sensitive_ todas las llaves, tokens y secretos.

3. **Settings → Functions**: _Fluid compute_ activado y región `iad1`.
4. **Deploy**.

## 4. Rama de producción

Vercel despliega a producción la rama por defecto del repo (hoy `chore/monorepo-scaffold`). Hay
dos caminos:

- Integra el trabajo en esa rama con un PR.
- O cambia la rama en **Settings → Environments → Production → Branch Tracking** en los dos
  proyectos.

Para que un cambio solo en la web no vuelva a desplegar el detector, ni al revés, activa en cada
proyecto **Settings → Git → Ignored Build Step → «Only build if there are changes in the root
directory»**.

## 5. Prueba de humo

1. Entra a `https://hatoscan.vercel.app` con una cuenta de la tabla `Usuarios`.
2. **Nuevo conteo** con una foto real de 10–30 MB. La barra de subida debe avanzar. La foto va
   directo a S3: si falla al empezar, revisa el CORS del bucket.
3. La detección termina y abre la revisión. Revisa en Airtable que la fila tenga la URL de la
   imagen y la del JSON del modelo, y en S3 que existan `counts/SIRIUS-CONTEO-XXXX/original.*` y
   `model-results/*.json`.
4. Guarda la revisión y comprueba que el conteo quede `revisado`, con `review-result.json` en el
   bucket.

## Operación

- **Rotar la llave de S3:**
  1. IAM → `hatoscan-web` → _Create access key_.
  2. Actualiza `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` en Vercel y vuelve a desplegar la web.
  3. Desactiva y borra la llave anterior.
- **Rotar `DETECTOR_API_TOKEN`:** cámbialo en los dos proyectos y vuelve a desplegar los dos.
- **Dominio propio:** agrégalo en Vercel y luego:
  1. Actualiza `APP_BASE_URL`.
  2. Agrega el origen al CORS del bucket (vuelve a ejecutar el script con el nuevo origen o edita
     el CORS en la consola).
- **Logs:** Vercel → proyecto → _Logs_. Un conteo en `error` muestra en la app el mensaje que dio
  el detector.
