# Materiais ilustrados — Granja Brasil

Dois PDFs para divulgação e onboarding da plataforma.

| Arquivo | Público | Conteúdo |
|---------|---------|----------|
| `pdf/Granja-Brasil-Moradores.pdf` | Moradores | Benefícios, funcionalidades, passo a passo e **QR Code** para cadastro |
| `pdf/Granja-Brasil-Sindicos-Administradores.pdf` | Síndicos e administradores | Arquitetura multi-condomínio, fluxos de comunicação, módulos, papéis, ControlID e **QR Code** para login |

## Como abrir

**Use os arquivos gerados** — não abra os templates em `moradores.html` / `sindicos-admin.html` diretamente no navegador (eles contêm placeholders como `{{APP_URL}}`).

- **PDF (impressão / WhatsApp):** `docs/brochures/pdf/`
- **HTML pronto (navegador):** `docs/brochures/build/`

## Regenerar

```bash
npm run brochures:pdf
```

O script injeta logo, links e QR codes em base64, gera os PDFs e salva HTMLs prontos em `build/`.

## Links nos QR codes

- Moradores: https://granjabrasil.app.br/signup
- Síndicos/admin: https://granjabrasil.app.br/login
