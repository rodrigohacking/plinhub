# 🚀 GUIA RÁPIDO DE SETUP

## O que você precisa fazer:

### 1️⃣ CRIAR CONTA SUPABASE (Banco de Dados)
📍 **Link**: https://supabase.com/

**Passos:**
1. Crie uma conta (grátis)
2. Clique em "New Project"
3. Preencha:
   - Name: `plin-db`
   - Database Password: **CRIE UMA SENHA FORTE E ANOTE**
   - Region: South America (São Paulo)
4. Aguarde ~2 minutos
5. Vá em **Settings** → **Database**
6. Role até **Connection String** → **URI**
7. **COPIE** a string completa (ex: `postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres`)

---

### 2️⃣ CRIAR APP META DEVELOPERS (Facebook Ads)
📍 **Link**: https://developers.facebook.com/apps/

**Passos:**
1. Clique em **"Create App"**
2. Escolha tipo: **Business**
3. Preencha:
   - App Name: `Plin Dashboard`
   - App Contact Email: seu email
4. Após criar, vá em **Settings** → **Basic**
5. **COPIE**:
   - `App ID` (ex: 1234567890123456)
   - `App Secret` (clique em "Show" para ver)
6. Vá em **"Add Product"** → Adicione **"Facebook Login"**
7. Em **Facebook Login** → **Settings**:
   - Valid OAuth Redirect URIs: `http://localhost:3001/api/auth/meta/callback`
   - Clique em **Save Changes**
8. Vá em **"Add Product"** → Adicione **"Marketing API"**

---

### 3️⃣ CONFIGURAR O BACKEND

**Abra o terminal e execute:**

```bash
cd backend

# Copiar arquivo de exemplo
cp .env.example .env

# Abrir .env no editor
code .env  # ou use seu editor preferido
```

**Preencha no arquivo `.env`:**
- `DATABASE_URL`: Cole a connection string do Supabase
- `META_APP_ID`: Cole o App ID do Meta
- `META_APP_SECRET`: Cole o App Secret do Meta

**As outras variáveis JÁ ESTÃO PREENCHIDAS** (SESSION_SECRET e ENCRYPTION_KEY foram geradas automaticamente)

---

### 4️⃣ INSTALAR E RODAR

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Criar tabelas no banco
npx prisma migrate dev --name init

# Iniciar servidor
npm run dev
```

Se tudo der certo, você verá:
```
🚀 Server running on http://localhost:3001
📊 Environment: development
⏰ Cron jobs started
```

---

## ✅ CHECKLIST

- [ ] Conta Supabase criada
- [ ] DATABASE_URL copiada
- [ ] App Meta Developers criado
- [ ] META_APP_ID e META_APP_SECRET copiados
- [ ] OAuth Redirect configurado no Meta
- [ ] Arquivo `.env` preenchido
- [ ] `npm install` executado
- [ ] `npx prisma generate` executado
- [ ] `npx prisma migrate dev` executado
- [ ] Servidor rodando em http://localhost:3001

---

## 🆘 PROBLEMAS COMUNS

### Erro: "Environment variable not found: DATABASE_URL"
→ Você não preencheu o `.env` corretamente

### Erro: "Can't reach database server"
→ Verifique se a DATABASE_URL está correta (senha, host, etc)

### Erro: "Invalid redirect_uri"
→ Verifique se você adicionou `http://localhost:3001/api/auth/meta/callback` no Meta Developers

---

## 📞 ME AVISE QUANDO:

1. ✅ Conseguir rodar o servidor
2. ❌ Tiver algum erro (me mande a mensagem de erro completa)
3. ❓ Tiver dúvida em algum passo
