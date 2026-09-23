# Quickstart — verificar el plano de decoración (021)

Cómo se comprueba, comando por comando, que las cuatro garantías están en pie. Nada de esto es
prosa: cada fila la decide un comando.

## Antes de empezar

La feature sale de `020-grafo-de-composicion`, que **no está en `main`** (23 commits). Si la 020 se
mergea antes de implementar, hay que rebasear:

```bash
git log --oneline main..HEAD | wc -l    # 0 si la 020 ya está en main
```

## Las cuatro garantías

### 1. Nadie elige la preocupación transversal

```bash
grep -rn "deco\|DecoratorsPort" src/composition/modules/ | wc -l     # 0
grep -rn "logged(\|administered(" src/composition/modules/ | wc -l   # 0
```

Y el comportamiento no cambió:

```bash
npm test                                  # las 1281 sin tocar una aserción preexistente
npx vitest run --project fast tests/integration/use-case-log.test.ts
```

Esta última es el juez del nombre del log: afirma `useCase: "ingestBatch"` para `ingestEvents`, que
es una de las dos operaciones donde el nombre del caso de uso no es el `operationId`.

### 2. Olvidarse no compila

```bash
npx vitest run --project fast tests/typecheck   # los fixtures de tipos
```

| Fixture                            | Lo que tiene que emitir                               |
| ---------------------------------- | ----------------------------------------------------- |
| el nuevo de esta feature           | `TS2345` … `CannotAudit<"…">`, nombrando la operación |
| `graph-missing-provider.ts` (020)  | `TS2345` … `Missing<"test.clock">`                    |
| `graph-operation-unwired.ts` (020) | `TS2345` … `Unwired<`                                 |

Y el repositorio entero compila sin excepciones:

```bash
npm run typecheck
npm run lint            # Lint exceptions: 0
```

### 3. Una acción que no se pudo auditar no ocurrió

```bash
npx vitest run --project fast tests/integration
```

Una prueba por clase de acción, y las tres afirman **dos** cosas:

| Acción                 | Respuesta                 | Estado del sistema                                        |
| ---------------------- | ------------------------- | --------------------------------------------------------- |
| crear un merchant      | `503` `store-unavailable` | el merchant **no existe**                                 |
| rotar una credencial   | `503` `store-unavailable` | la credencial anterior sigue vigente; no se acuñó ninguna |
| cambiar el interruptor | `503` `store-unavailable` | el interruptor quedó como estaba                          |

La segunda afirmación es la que importa: sin ella la prueba pasaría con la implementación que
falla **después** de actuar, que es justo lo que la decisión descarta.

Y lo que no es administrativo no se ve afectado con el registro caído: ingesta, catálogo y órdenes
siguen respondiendo lo de siempre.

### 4. El kernel no compara códigos por texto

```bash
grep -rn '"merchant-out-of-scope"' src/application/shared-kernel/   # 0
npx vitest run --project fast tests/unit/application/shared-kernel/audited-use-case.test.ts
```

Esa prueba importa el `MerchantOutOfScope` real, así que si la declaración del error se rompe, falla.

## Que el contrato no se movió

```bash
npm run contract:check      # incluye contract:diff contra origin/main
```

Cero diff (FR-014). Si aparece cualquier cambio, algo salió del alcance.

## Que el vocabulario generado está al día

```bash
npm run contract:types:check
```

Falla si `generated/` quedó desactualizado respecto del contrato. Y para ver qué derivó:

```bash
grep -c "" generated/audited-operations.d.ts
```

Tiene que nombrar **diez** operaciones: las tres rotaciones, crear y dar de baja un merchant, el
interruptor, publicar configuración y las tres transiciones de experimento.

## La cadena completa, como la corre CI

```bash
npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:tools
npm run contract:check && npm run test:contract && npm run release-check
npm run test:mutation
```

## Dónde se toca qué

| Si querés cambiar…                                | Se toca                                                        | Lo verifica                            |
| ------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| qué operaciones se auditan                        | **el contrato** (la capacidad o el consumidor de la operación) | `contract:types:check` y el compilador |
| qué lee la entrada de una operación auditada      | esa operación, en su módulo                                    | las pruebas del registro               |
| el nombre con que una operación aparece en el log | esa operación, en su módulo                                    | `use-case-log.test.ts`                 |
| que una acción sin auditar no ocurra              | el decorador de auditoría                                      | las tres pruebas de integración        |
| agregar una operación administrativa de escritura | el contrato y su módulo                                        | olvidarse **no compila**               |

Esa última fila es el criterio de éxito de la feature (SC-008): agregar una operación
administrativa nueva no requiere recordar nada.

## Lo que esto **no** verifica

La ventana en que el registro se cae **durante** una acción: la acción ocurre y no queda
constancia. No se cierra acá, está documentada en ADR-034 y su cierre es requisito del hito
`persistence-and-resilience`, donde habrá transacción. Hoy el registro vive en memoria y la ventana
es teórica.
