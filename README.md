# Sistema de Gestão - Plin

Este é um sistema de dashboard de vendas e marketing desenvolvido com React, Vite e Tailwind CSS.

## Pré-requisitos

Você precisa ter o [Node.js](https://nodejs.org/) instalado em sua máquina.

## Como rodar o projeto

1. Abra o terminal na pasta do projeto.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse o sistema no navegador (geralmente em `http://localhost:5173`).

## Funcionalidades

- **Multi-empresa**: Gerencie múltiplas empresas.
- **Dashboard de Vendas**: KPIs, gráficos de evolução, distribuição por canais.
- **Dashboard de Marketing**: Funil de conversão, ROI por canal.
- **Comparativo**: Ranking entre empresas.
- **Gestão**: Adicionar vendas, campanhas e definir metas.
- **Persistência**: Os dados são salvos automaticamente no LocalStorage do navegador.

## Estrutura do Projeto

- `src/components`: Componentes reutilizáveis (Charts, Cards, Layout).
- `src/lib`: Lógica de dados e utilitários.
- `src/App.jsx`: Componente principal e rotas.
