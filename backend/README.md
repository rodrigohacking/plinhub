# Plin Backend API

Backend Node.js para integração com Meta Ads e Pipefy.

## 🚀 Setup Rápido

### 1. Instalar Dependências
```bash
cd backend
npm install
```

### 2. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
```

Edite o `.env` e preencha:
- `DATABASE_URL`: URL do PostgreSQL (Supabase ou local)
- `META_APP_ID` e `META_APP_SECRET`: Credenciais do app Meta
- `ENCRYPTION_KEY`: Chave de 32 caracteres para criptografia
- `SESSION_SECRET`: Chave aleatória para sessões

### 3. Configurar Banco de Dados
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Iniciar Servidor
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

---

## 📡 Endpoints da API

### Autenticação Meta Ads

#### `GET /api/auth/meta/connect?companyId=123`
Inicia o fluxo OAuth do Meta Ads

#### `GET /api/auth/meta/callback`
Callback do OAuth (configurado no Meta Developers)

#### `POST /api/auth/meta/disconnect`
Desconecta integração Meta Ads
```json
{
  "companyId": 123
}
```

---

### Integrações

#### `GET /api/integrations/:companyId`
Lista todas as integrações da empresa

#### `POST /api/integrations/:companyId/pipefy`
Salva configuração Pipefy
```json
{
  "pipefyOrgId": "300567",
  "pipefyPipeId": "1029384",
  "pipefyToken": "Bearer xxx"
}
```

#### `POST /api/integrations/:companyId/pipefy/test`
Testa conexão Pipefy
```json
{
  "pipefyToken": "Bearer xxx"
}
```

#### `POST /api/integrations/:companyId/meta/test`
Testa conexão Meta Ads (usa token salvo)

#### `DELETE /api/integrations/:companyId/:type`
Remove integração (type: `pipefy` ou `meta_ads`)

---

### Métricas

#### `GET /api/metrics/:companyId?source=meta_ads&range=30d`
Busca métricas filtradas
- `source`: `meta_ads` | `pipefy` (opcional)
- `range`: `7d`, `30d`, `90d` (padrão: 30d)

#### `GET /api/metrics/:companyId/unified`
Dashboard unificado com dados comparativos

Resposta:
```json
{
  "metaAds": {
    "total": { "spend": 1500, "impressions": 50000, ... },
    "daily": [...]
  },
  "pipefy": {
    "total": { "cardsCreated": 120, "cardsConverted": 45 },
    "daily": [...]
  },
  "comparative": {
    "costPerLead": 12.5,
    "costPerConversion": 33.33,
    "leadsToConversionRate": 37.5
  }
}
```

---

### Sincronização

#### `POST /api/sync/:companyId/force`
Força sincronização manual

#### `GET /api/sync/:companyId/logs?limit=50`
Histórico de sincronizações

---

## 🔐 Segurança

- Tokens são criptografados com AES antes de salvar no banco
- OAuth 2.0 para autenticação Meta Ads
- CORS configurado para frontend específico
- Helmet.js para headers de segurança

---

## ⏰ Cron Jobs

O sistema roda uma sincronização automática diária às 6h da manhã.

Para desabilitar:
```env
ENABLE_CRON=false
```

Para mudar o horário:
```env
SYNC_SCHEDULE="0 2 * * *"  # 2h da manhã
```

---

## 🗄️ Banco de Dados

### Modelos Prisma

- **Company**: Empresas cadastradas
- **Integration**: Configurações de integração (Pipefy/Meta)
- **Metric**: Métricas diárias agregadas
- **SyncLog**: Histórico de sincronizações

### Comandos Úteis

```bash
# Abrir Prisma Studio (GUI do banco)
npx prisma studio

# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Reset do banco (CUIDADO!)
npx prisma migrate reset
```

---

## 🧪 Testando a API

### Testar Health Check
```bash
curl http://localhost:3001/health
```

### Testar Conexão Pipefy
```bash
curl -X POST http://localhost:3001/api/integrations/1/pipefy/test \
  -H "Content-Type: application/json" \
  -d '{"pipefyToken":"Bearer SEU_TOKEN"}'
```

---

## 📦 Deploy

### Opção 1: Railway
1. Conecte o repositório
2. Configure variáveis de ambiente
3. Deploy automático

### Opção 2: Render
1. New Web Service
2. Build: `npm install`
3. Start: `npm start`

### Opção 3: Vercel (Serverless)
Requer adaptação para serverless functions.

---

## 🐛 Troubleshooting

### Erro: "ENCRYPTION_KEY must be at least 32 characters"
Gere uma chave aleatória:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Erro: "Meta OAuth redirect mismatch"
Verifique se a `META_REDIRECT_URI` no `.env` está igual à configurada no Meta Developers.

### Erro: "Prisma Client not generated"
```bash
npx prisma generate
```

---

## 📝 Logs

Logs são exibidos no console durante desenvolvimento.

Para produção, considere usar:
- Winston
- Pino
- Datadog

---

## 🤝 Contribuindo

1. Crie uma branch para sua feature
2. Faça commit das mudanças
3. Abra um Pull Request
