# Materiais ilustrados — Granja Brasil

Dois PDFs para divulgação e onboarding da plataforma.

| Arquivo | Público | Conteúdo |
|---------|---------|----------|
| `pdf/Granja-Brasil-Moradores.pdf` | Moradores | Benefícios, funcionalidades, passo a passo e **QR Code** para `/signup` |
| `pdf/Granja-Brasil-Sindicos-Administradores.pdf` | Síndicos e administradores | Arquitetura multi-condomínio, fluxos de comunicação, módulos, papéis, ControlID e **QR Code** para `/login` |

## Regenerar os PDFs

```bash
npm run brochures:pdf
```

Os HTMLs-fonte ficam em `moradores.html` e `sindicos-admin.html`. O script `scripts/generate-brochures.mjs` injeta logo, QR codes e gera os PDFs via Puppeteer.

## Links nos QR codes

- Moradores: https://granjabrasil.app.br/signup
- Síndicos/admin: https://granjabrasil.app.br/login
