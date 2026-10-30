# Dockerfile para validação local - Playwright API tests
# Node.js compatível com >=24.14.1 conforme .nvmrc/package.json
FROM node:24.14.1-slim

# Variáveis de ambiente para execução não-interativa
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    CI=true

# Criar diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema mínimas necessárias
# git é necessário para a análise de impacto do pre-push dentro do contêiner
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# O repositório é montado em /app; permitir que o usuário não-root o inspecione
RUN git config --system --add safe.directory /app

# Copiar apenas arquivos necessários para instalação de dependências (cache eficiente)
COPY package.json package-lock.json ./

# Instalar dependências de forma reproduzível (devDependencies + binários opcionais de plataforma)
RUN npm ci --include=dev

# Copiar código fonte necessário para execução dos testes
COPY tsconfig.json ./
COPY playwright.config.ts ./
COPY playwright.latencia.config.ts ./
COPY contracts ./contracts
COPY scripts ./scripts
COPY tests ./tests
COPY .env.example ./

# Criar diretórios para relatórios (serão montados via volume se necessário)
RUN mkdir -p /app/test-results /app/playwright-report /app/reports /app/performance-results

# Executar como usuário não-privilegiado
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# Comando padrão: typecheck + testes de contrato locais (seguros, sem rede)
# Pode ser sobrescrito via docker compose run
CMD ["sh", "-c", "npm run typecheck && npm run test:contratos"]
