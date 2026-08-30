# Desplegar TYPELY

> **Ramas.** Dos, largas. En **`dev`** se trabaja; **`production`** es la que
> queda desplegada y sólo recibe cambios que ya andan. Nunca commitear directo a
> `production`. Ver `CLAUDE.md` §17.
>
> **El deploy es MANUAL y lo hace Ezequiel desde Coolify.** No hay autodeploy y
> no queremos uno: un merge a `production` no publica nada por sí solo. Si
> alguna vez aparece un workflow que despliegue en un push, es un error —
> sacalo.

---

## 0. Qué se despliega

Tres contenedores, definidos en `docker-compose.yml`:

| Servicio | Qué es | Imagen |
|---|---|---|
| `mecanografia` | El frontend: Vite + React compilado a estáticos, servido por Nginx | `Dockerfile` + `nginx.conf` |
| `api` | Fastify + Drizzle | `Dockerfile.api` |
| `db` | Postgres 16 | oficial, con `db/init/*.sql` |

`nginx.conf` hace el fallback de SPA. Los tres van atados a loopback: el proxy
de adelante es el que publica.

---

## 1. Variables que el build del frontend necesita

**Esto es lo que más fácil se rompe y es silencioso.** Vite **inlinea** las
variables `VITE_*` en el bundle en tiempo de BUILD, no de arranque. Si el build
sale sin ellas, el bundle queda sin ellas y el login con Google deja de
funcionar — sin ningún error en los logs del contenedor.

```
VITE_GOOGLE_CLIENT_ID=<el client id de Google>
VITE_GOOGLE_ALLOWED_DOMAINS=<vacío = cualquier dominio>
```

En Coolify van como build args / build-time environment del servicio del
frontend, **no** como variables de runtime.

**Nunca pongas un secreto en una `VITE_*`**: termina en el bundle público, que
cualquiera puede leer. Los secretos del backend van por el punto 2.

---

## 2. Secretos del backend

`db` y `api` los leen de archivos montados en `/run/secrets/*`. **Nunca se
commitean valores reales**; `secrets/` está en `.gitignore`.

```bash
mkdir -p secrets
openssl rand -base64 64 > secrets/jwt_secret.txt
openssl rand -base64 24 | tr -d '/+=' > secrets/db_password.txt
printf 'postgres://typely:%s@db:5432/typely\n' "$(cat secrets/db_password.txt)" > secrets/database_url.txt
: > secrets/resend_api_key.txt   # vacío = sin mails de invitación, sólo link
chmod 600 secrets/*.txt
```

`RESEND_API_KEY` es opcional: vacío, el endpoint de invitación devuelve 503 y
el admin comparte un link en su lugar. El producto anda completo sin eso.

---

## 3. Sembrar el superadmin — una sola vez

Idempotente. Crea el superadmin, la primera sede ("Principal") e imprime la
contraseña por stdout **una sola vez**. Cambiala después del primer login.

```bash
docker compose exec -e SUPERADMIN_PASSWORD='una-contraseña-fuerte' api node dist/seed.js
```

El correo del superadmin sale de `SUPERADMIN_EMAIL`; exportalo antes si querés
otro que el que trae por defecto.

---

## 4. Verificar que quedó bien

Después de cada deploy, en este orden:

```bash
docker compose ps                      # los tres arriba, db healthy
docker compose logs --tail=50 api
curl -I http://127.0.0.1:3005          # el frontend responde 200
curl -s http://127.0.0.1:3006/health   # la API responde
```

Y el chequeo que atrapa el error del punto 1, porque es el único que lo ve:

```bash
curl -s http://127.0.0.1:3005/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
```

Ese hash tiene que coincidir con el de `dist/index.html` del build que
publicaste. Si no coincide, se está sirviendo un bundle viejo.

Por último, entrar a la app y probar **el login con Google**: es lo que se cae
sin ruido si el build salió sin las `VITE_*`.

---

## 5. Volver atrás

`production` es el registro de lo que está corriendo. Para volver, se
redespliega el commit anterior de esa rama desde Coolify. La base **no** vuelve
atrás sola: si el cambio incluía una migración, revisala antes.

---

## 6. Base de datos

La DB de producción es **Supabase**, no el contenedor `db` del compose — ese
queda para desarrollo local. Los respaldos son los de Supabase.

---

## Lo que hay que completar

Este documento sobrevivió a una mudanza de servidor y todavía le falta lo
propio del nuevo. **Escribilo acá cuando lo tengas a mano**, en vez de dejarlo
en la cabeza de una sola persona:

- El nombre del proyecto y de los servicios en Coolify.
- Qué dominio sirve cada uno y quién termina el TLS.
- Dónde viven los secretos en Coolify y cómo se rotan.
- Cuánta RAM tiene la máquina nueva. **Importa**: en el servidor anterior el
  build del frontend no entraba en 956 MB — moría por OOM y había que subir el
  `dist` ya compilado. Si la nueva es igual de chica, va a hacer falta el mismo
  truco y conviene que quede escrito antes de descubrirlo en un deploy.
