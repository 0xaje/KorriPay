FROM node:23.2.0-alpine AS builder

RUN apk add --no-cache python3 make g++ git
RUN npm install -g pnpm@10.5.2

WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/docs/package.json ./apps/docs/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/errors/package.json ./packages/errors/
COPY packages/ui/package.json ./packages/ui/
COPY packages/sdk/package.json ./packages/sdk/
COPY services/settlement-engine/package.json ./services/settlement-engine/
COPY services/compliance/package.json ./services/compliance/
COPY services/treasury/package.json ./services/treasury/
COPY services/proof/package.json ./services/proof/
COPY services/attestation/package.json ./services/attestation/
COPY services/notification/package.json ./services/notification/
COPY contracts/settlement/package.json ./contracts/settlement/
COPY contracts/treasury/package.json ./contracts/treasury/
COPY contracts/identity/package.json ./contracts/identity/

RUN pnpm install

COPY . .

RUN pnpm run build

FROM node:23.2.0-alpine AS runner
WORKDIR /app
COPY --from=builder /app /app

CMD ["node", "apps/api/dist/index.js"]
