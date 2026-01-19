# Backend API - Beth Mirage

Backend server para automação de emails usando Resend.

## 🚀 Início Rápido

1. **Instale as dependências:**
```bash
npm install
```

2. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

3. **Coloque o PDF do e-book:**
```bash
mkdir -p media
# Copie o PDF para media/ebook.pdf
# O PDF deve estar em server/media/ebook.pdf
```

4. **Inicie o servidor:**
```bash
npm run dev  # Desenvolvimento
npm start    # Produção
```

## 📡 Endpoints

### POST `/api/subscribe`
Subscreve usuário e envia e-book por email.

**Request:**
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "consent": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "E-book enviado com sucesso! Verifique sua caixa de entrada."
}
```

### POST `/api/stories`
Salva relato/testemunho.

**Request:**
```json
{
  "identificationType": "realName",
  "story": "Minha história...",
  "name": "João Silva",
  "email": "joao@exemplo.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Relato enviado com sucesso. Obrigado por compartilhar sua voz."
}
```

### GET `/api/health`
Verifica se a API está funcionando.

## 📦 Estrutura

```
server/
├── server.js              # Servidor Express principal
├── services/
│   ├── brevoService.js    # Serviço de email Resend
│   └── database.js         # Serviço de banco de dados (placeholder)
├── ebooks/                # Pasta para PDFs
└── package.json
```

## 🔧 Configuração

Configure a variável de ambiente `RESEND_API_KEY` com sua chave da API do Resend.

## 📝 Notas

- O arquivo `database.js` é um placeholder. Implemente sua própria lógica de banco de dados.
- Para produção, configure um banco de dados real (MongoDB, PostgreSQL, etc.)
- Configure rate limiting para prevenir abuso
- Use HTTPS em produção
