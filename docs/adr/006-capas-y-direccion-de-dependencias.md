---
numero: 6
titulo: Capas y dirección de dependencias
estado: reemplazada
fecha: 2026-09-16
fuente: specs/002-gobernanza-contrato-codigo/research.md
---

# ADR-006 — Capas y dirección de dependencias

## Contexto

La constitución (principio I) exige un módulo por autoridad, composition root único y ningún
cliente de infraestructura fuera de él. Hasta la 002 era prosa.

## Decisión

Cuatro capas bajo `src/`, con la dirección de dependencia verificada por dependency-cruiser
(`.dependency-cruiser.cjs`, `npm run arch`, en `npm test` y en CI):

| Capa            | Importa de                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `domain/`       | sólo `domain/`. Nada de npm ni de Node, **tipos incluidos**                                    |
| `ports/`        | `domain/`, `ports/`                                                                            |
| `adapters/<x>/` | `ports/`, `domain/`, el propio adaptador, `generated/`, npm/Node; tipos de `handlers/typed.ts` |
| `handlers/`     | `domain/`, `ports/`, `generated/`, `handlers/`                                                 |
| `main.ts`       | todo; nadie lo importa                                                                         |

La excepción de tipos hacia `handlers/typed.ts` está nombrada en la configuración. No se
confía en la detección `type-only` de la herramienta para permitir dependencias en el
dominio: un import mixto puede clasificarse mal.

## Consecuencias

- Una autoridad nueva nace en `domain/<autoridad>/` sin poder importar Redis, Postgres ni HTTP.
- Los DTO del contrato se traducen en `handlers/`; el dominio no conoce los tipos generados.
