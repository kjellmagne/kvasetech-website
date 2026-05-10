# Kvasetech Website

Kvasetech AS website for [kvasetech.com](https://kvasetech.com).

The site is a mostly static HTML/CSS/JS page served by a small Node.js backend. The backend exists so the contact form can submit to `/api/contact` and send mail through the internal SMTP relay.

## Current Production Shape

- Public site: `https://kvasetech.com`
- Container image after repo rename: `ghcr.io/kjellmagne/kvasetech-website:latest`
- Current live container may still run the pre-rename image `ghcr.io/kjellmagne/kvasetech_website:latest` until the next controlled deploy.
- Runtime: Node.js 20
- App internal port: `8080`
- Host port on Ubuntu server: `8082`
- Docker mapping: `8082:8080`
- Contact email: `post@kvasetech.com`
- SMTP relay host: `192.168.222.12`
- SMTP TLS server name: `email.kvasetech.com`
- APISIX forwards `kvasetech.com` to the website container.

## Project Files

- `index.html`: the website UI, contact form, and frontend JavaScript
- `assets/`: images and logo assets used by the site
- `server.js`: Express server, static file serving, health check, and contact form email handling
- `package.json` / `package-lock.json`: Node dependencies and scripts
- `Dockerfile`: production container build
- `.github/workflows/docker-image.yml`: GitHub Actions image build and push
- `.env.example`: non-secret environment template
- `secrets.md`: local-only secret inventory, ignored by git

## Local Setup On A New Mac

Clone the repo:

```bash
git clone https://github.com/kjellmagne/kvasetech-website.git
cd kvasetech-website
```

Use Node 20. With `nvm`:

```bash
nvm install
nvm use
```

Install dependencies:

```bash
npm install
```

Create local environment if needed:

```bash
cp .env.example .env
```

Run locally:

```bash
npm start
```

Open:

```text
http://127.0.0.1:8080
```

Health check:

```bash
curl http://127.0.0.1:8080/healthz
```

## Verification

Run basic checks before committing:

```bash
npm run check
npm run audit:prod
```

Test contact validation locally:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/contact \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'name=Test&email=bad&message=Hei'
```

Expected result:

```json
{"ok":false,"error":"Skriv inn en gyldig e-postadresse."}
```

If SMTP relay is available from your machine, test a real send:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/contact \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'name=Test' \
  --data-urlencode 'email=post@kvasetech.com' \
  --data-urlencode 'message=Test from local development'
```

Expected result when SMTP is reachable:

```json
{"ok":true}
```

## Contact Form

The frontend form posts to:

```text
POST /api/contact
```

The backend validates:

- `name`
- `email`
- `message`
- hidden honeypot field `company`

The backend sends plain text email to `MAIL_TO`, defaulting to `post@kvasetech.com`.

## Environment Variables

Defaults are defined in code where safe, but production should set these explicitly:

```env
PORT=8080
SMTP_HOST=192.168.222.12
SMTP_SERVERNAME=email.kvasetech.com
SMTP_PORT=25
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=post@kvasetech.com
MAIL_TO=post@kvasetech.com
```

Notes:

- `SMTP_HOST` is an internal IP.
- `SMTP_SERVERNAME` is used for TLS certificate verification because the certificate is issued for `email.kvasetech.com`, not the IP address.
- Leave `SMTP_USER` and `SMTP_PASS` empty when the mail server allows relay from the backend host.

## Docker

Build locally:

```bash
docker build -t kvasetech_website .
```

Run locally:

```bash
docker run --rm -p 8082:8080 \
  -e PORT=8080 \
  -e SMTP_HOST=192.168.222.12 \
  -e SMTP_SERVERNAME=email.kvasetech.com \
  -e SMTP_PORT=25 \
  -e SMTP_SECURE=false \
  -e SMTP_REQUIRE_TLS=false \
  -e MAIL_FROM=post@kvasetech.com \
  -e MAIL_TO=post@kvasetech.com \
  kvasetech_website
```

Open:

```text
http://127.0.0.1:8082
```

## GitHub Actions And Image Publishing

On push to `main`, GitHub Actions builds and pushes:

```text
ghcr.io/kjellmagne/kvasetech-website:latest
```

It also tags SHA-based images.

Workflow file:

```text
.github/workflows/docker-image.yml
```

## Ubuntu Deployment

Production server:

```text
192.168.222.171
```

Current container name:

```text
kvasetech_website
```

Update deployment after a successful GitHub Actions build:

```bash
docker pull ghcr.io/kjellmagne/kvasetech-website:latest
docker rm -f kvasetech_website || true
docker run -d --name kvasetech_website --restart always \
  -p 8082:8080 \
  -e PORT=8080 \
  -e SMTP_HOST=192.168.222.12 \
  -e SMTP_SERVERNAME=email.kvasetech.com \
  -e SMTP_PORT=25 \
  -e SMTP_SECURE=false \
  -e SMTP_REQUIRE_TLS=false \
  -e MAIL_FROM=post@kvasetech.com \
  -e MAIL_TO=post@kvasetech.com \
  ghcr.io/kjellmagne/kvasetech-website:latest
```

Server-side checks:

```bash
docker ps --filter name=kvasetech_website
curl http://127.0.0.1:8082/healthz
curl -I http://127.0.0.1:8082/
```

Public checks:

```bash
curl https://kvasetech.com/healthz
curl -I https://kvasetech.com/
```

## APISIX

The website depends on these APISIX routes:

- `kvasetech.com` `/` to the website upstream
- `kvasetech.com` `/*` to the website upstream
- `kvasetech.com` `/api/contact` specifically to the website upstream

The specific `/api/contact` route is important because older compatibility routes also use `/api/*`.

Website upstream:

```text
192.168.222.171:8082
```

## Secrets

Do not commit real secrets to git.

Use local `secrets.md` for the private inventory. It is ignored by git and should be copied separately when moving to a new machine.

Known secret categories:

- Ubuntu SSH password or SSH key details
- APISIX admin key
- GitHub token, if still needed
- SMTP credentials, if the relay ever requires login

Rotate any password, API key, or token that has been pasted into a chat, terminal log, issue, or unencrypted file.

## Moving To Another Mac

Before moving:

1. Commit and push all tracked work.
2. Copy local-only `secrets.md` separately if you need it.
3. Do not copy `node_modules/`; run `npm install` on the new Mac.
4. Do not copy `.env` unless you intentionally need local SMTP settings.
5. Verify the new Mac has SSH access to GitHub and the Ubuntu server.

On the new Mac:

1. Clone the repository.
2. Install/use Node 20.
3. Run `npm install`.
4. Copy or recreate `.env` from `.env.example` if needed.
5. Run `npm run check` and `npm run audit:prod`.
6. Run `npm start` and test `http://127.0.0.1:8080/healthz`.

## Cleanup Notes

The project should not contain generated local folders in git:

- `node_modules/`
- `.claude/`
- `.env`
- `secrets.md`
- `.DS_Store`

These are ignored by `.gitignore`.
