# Coding Standards

All code contributions must align with the following development standards:

## TypeScript & Type Safety

- **Strict Mode**: `strict` mode is enabled. No `any` types are allowed unless explicitly justified (e.g. wrapper typing).
- **TypeScript Imports**: Use ESM `.js` suffix on local imports (e.g., `import { MyType } from "./types/index.js"`).
- **No Implicit Casts**: Prefer explicit type casting and type guard checkers.

## Error Handling

- All code must utilize classes from the `@korripay/errors` library.
- Custom application exceptions should extend `ApplicationError`.
- **Never expose raw stack traces** to final clients. Catch errors at the interface boundaries and map them to standard API responses.

## Logging

- **No Console Logging**: Never use `console.log()` inside application code.
- **Pino Logger**: Use Pino wrappers. Every log item should include standard attributes (correlationId, service metadata) to enable tracing across system components.
- Log levels must match environment specs (`debug` for development, `error` for production).
