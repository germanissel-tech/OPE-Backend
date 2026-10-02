# Implementation Plan: Los niveles 1 y 2 se configuran por API

**Branch**: `036-niveles-por-api` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/036-niveles-por-api/spec.md`

## Summary

Los dos niveles que están por encima del merchant —las reglas de la plataforma y los defaults de
tratamiento— pasan a publicarse por la API de administración como versiones numeradas e inmutables, con el
mismo trato de congelamiento que el nivel merchant: con experimentos activos alcanzados hace falta un motivo
declarado, y entonces se reinicia la ventana de medición de cada uno.

El molde existe entero un nivel más abajo. Lo que la fase 0 encontró y el diseño tiene que resolver son
cuatro cosas: **la unidad de comparación es la hoja, no el campo**; el nivel de plataforma **está horneado
en el grafo en once sitios** y hay que darle un lector; **invalidar alcanza** y abarata la feature; y dos
costuras del molde no llegan —el registro de reinicio no dice de qué nivel es la versión, y el caso de uso
ya está en el límite de seis dependencias—.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) con `strict`, como todo `src/`.

**Primary Dependencies**: ninguna nueva. `node:sqlite` ya está.

**Storage**: SQLite (**D-21**). Una tabla para los dos niveles, con el nivel como parte de la clave y
`MAX(version)+1` por nivel dentro de una transacción, como `merchant_configurations`. Una migración nueva.

**Testing**: Vitest. Unitarias e integración en `fast`; lo que cruza un reinicio, en `durability` (regla de
gateways durables). La medición de SC-006, en `durability` como las otras dos.

**Target Platform**: el servidor del MVP, una instancia.

**Project Type**: backend con anillos (ADR-013). Módulo `configuration` dueño de los niveles.

**Performance Goals**: el camino de decisión no gana I/O (FR-015). Un cambio de nivel cuesta lo que un
arranque en frío: una lectura por merchant en su próximo pedido, que es lo que ya pasa hoy tras un reinicio.

**Constraints**: cero cambios de forma en lo que el SDK recibe (FR-017). Seis dependencias como máximo por
caso de uso (ADR-023). Ninguna política en el código (constitución XI) — esta feature es la que lo completa.

**Scale/Scope**: 22 valores en dos niveles, 6 operaciones nuevas, una migración, once sitios de
composición que pasan de valor a lector.

## Constitution Check

_Constitución **v1.4.4**. Se evalúan los once principios; los que no aplican se marcan como tales._

| Principio                                           | Veredicto                                              | Por qué                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                    | ✅ cumple                                              | El módulo `configuration` sigue siendo el dueño de los niveles y de la resolución, y nadie lo importa: cada consumidor declara su puerto de lectura y la composición enlaza. Lo que cambia es de dónde saca el contenido, no quién manda.                                                                                                                                                                                                                 |
| **II. Fail-closed**                                 | ✅ cumple                                              | Un valor inválido se rechaza nombrando el campo y no crea versión; un almacén que no acepta escribir no deja ni versión ni entrada de auditoría (la unidad de trabajo de ADR-042). Ante la duda, nada cambia.                                                                                                                                                                                                                                             |
| **III. La medición precede y no se contamina**      | ⚠️ **tensión declarada, y es el asunto de la feature** | Un cambio de nivel 1 o 2 **puede** contaminar mediciones en curso — y ya puede hoy, por deploy, sin rastro y sin reiniciar ninguna ventana. La feature no agrega el riesgo: lo pone bajo reglas (motivo obligatorio, ventana reiniciada por experimento alcanzado, entrada en el registro) y **acota a quién alcanza** por hoja (FR-007). El principio queda mejor servido después que antes, y eso es lo que la enmienda de ADR-031 tiene que registrar. |
| **IV. Dos caminos, dos garantías**                  | ✅ cumple                                              | Los lectores nuevos son llamadas en memoria; la resolución sigue sirviéndose de memoria y la invalidación no agrega I/O al camino crítico más allá de la relectura perezosa que ya existe tras un arranque. SC-006 lo mide.                                                                                                                                                                                                                               |
| **V. Aislamiento por merchant**                     | ✅ cumple, **con una vuelta de tuerca**                | Un cambio de nivel alcanza a todos los merchants a propósito; lo que se verifica es que los alcanza **de la misma forma** y que lo declarado por uno no se filtra a otro (FR-016). Lo que cada merchant declara sigue ganando (FR-007).                                                                                                                                                                                                                   |
| **VI. Identidad explícita, idempotencia explícita** | ✅ cumple, **y la mejora**                             | La versión de cada nivel pasa a ser **acuñada por OPE y correlativa** en lugar de un nombre declarado en un archivo que nada obliga a cambiar. Y un cuerpo idéntico repite la versión en vez de crear otra, como el nivel merchant.                                                                                                                                                                                                                       |
| **VII. OPE observa comportamiento, no personas**    | ➖ no aplica                                           | No hay datos de personas en ningún nivel.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **VIII. Cero modelos de lenguaje en runtime**       | ➖ no aplica                                           | Ninguna inferencia.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **IX. Nada entra al reporte sin trazabilidad**      | ✅ cumple, **y es lo que la feature agrega**           | Hoy un cambio de estos niveles por deploy no deja ninguna traza. Después, toda publicación tiene actor, instante, motivo cuando hubo medición en curso, y versión; y cada decisión sigue estampando la terna.                                                                                                                                                                                                                                             |
| **X. Puertos en los dos bordes**                    | ✅ cumple                                              | El almacén de niveles entra por un puerto del módulo `configuration` con dos implementaciones (memoria y durable), enlazadas por tecnología (ADR-033). Los once sitios de composición pasan a recibir un lector, que también es un puerto.                                                                                                                                                                                                                |
| **XI. Ninguna política vive en el código**          | ✅ cumple, **y la completa**                           | El principio dice que todo valor de comportamiento es configuración en tres niveles. Hasta ahora dos de los tres sólo se cambiaban con un deploy, así que el principio se cumplía en la forma y no en el uso. Esta feature es la que lo hace cierto de punta a punta.                                                                                                                                                                                     |

**Veredicto**: pasa con **una tensión declarada** en el principio III, que es el asunto de la feature y no
un efecto colateral. La comparación contra el deploy —el mismo daño, peor y sin rastro— es lo que la
sostiene, y va escrita en la enmienda de ADR-031.

## Project Structure

### Documentation (this feature)

```text
specs/036-niveles-por-api/
├── plan.md              # Este archivo
├── research.md          # Fase 0: seis preguntas, cuatro respuestas que cambian el diseño
├── data-model.md        # Fase 1: la versión de un nivel, las hojas y lo alcanzado
├── quickstart.md        # Fase 1: cómo se verifica, incluido cambiar un valor sin reiniciar
├── checklists/
│   └── requirements.md  # Calidad de la spec
└── tasks.md             # Fase 2 (`/speckit-tasks`)
```

### Source Code (repository root)

```text
migrations/
└── 005-configuration-levels.sql            # una tabla, clave (level, version)

src/domain/configuration/
├── level-version.ts                        # la entidad: nivel, número, contenido, actor, motivo
└── changed-leaves.ts                       # las hojas que cambian entre dos versiones

src/domain/experiment/
└── experiment.ts                           # `WindowRestart` dice de qué nivel es la versión

src/application/configuration/
├── ports/level-store.ts                    # publicar, última, listar, una
├── services/reached-experiments.service.ts # los activos, cuáles alcanza un conjunto de hojas, reiniciar
└── use-cases/                              # publicar cada nivel, listar versiones, leer una

src/interface-adapters/configuration/
├── gateways/{memory,sqlite}-level-store.ts
└── controllers/                            # seis operaciones

src/composition/modules/                    # once sitios: de valor a lector
```

**Structure Decision**: el módulo `configuration` es el dueño y no aparece ningún módulo nuevo. La entidad
de una versión de nivel vive en el dominio porque tiene reglas (un contenido igual al vigente no es una
versión nueva; una correctiva exige motivo), igual que `MerchantConfigurationVersion`.

## Diseño

### Lo alcanzado, que es la parte con filo

Publicar un nivel compara la versión saliente con la entrante y obtiene **las hojas que cambiaron** — hojas
y no campos, porque seis de los diez campos de tratamiento se mezclan clave por clave y un merchant puede
declarar una hoja de un objeto y no las otras (research R-01).

Con ese conjunto:

- un merchant está **no alcanzado** si declara **todas** las hojas que cambiaron;
- un experimento está **alcanzado** si su merchant no lo está y el experimento está **activo** (uno en
  calibración no cuenta: sus decisiones ya están excluidas del análisis).

Cualquier atajo acá falla del lado peor: leer por campo en vez de por hoja deja ventanas corriendo sobre un
tratamiento que cambió.

### El orden de una publicación de nivel

El del molde, con dos diferencias: el alcance se juzga contra **todos** los merchants y no contra uno, y el
reinicio es de **varias** ventanas.

1. El operador tiene alcance total, o se rechaza sin decir nada de ningún merchant.
2. Borrador: contenido válido contra las invariantes del código, y motivo si viene declarado.
3. ¿Idéntico a la versión vigente? Entonces se repite, no se crea (FR-003).
4. Hojas que cambian → experimentos alcanzados.
5. Hay alcanzados y no hay motivo ⇒ **rechazo por configuración congelada**.
6. Publicar (la versión la acuña el almacén), **invalidar** la configuración efectiva y los niveles, y
   reiniciar la ventana de cada experimento alcanzado.
7. Todo eso dentro de la unidad de trabajo de ADR-042: o queda con su entrada de auditoría, o no queda.

### El nivel de plataforma, de valor a lector

Once sitios reciben hoy un valor del nivel al construirse (research R-02). Pasan a recibir un **lector** y
consultan al usar. Ninguno gana I/O: el nivel vigente está en memoria.

Lo que **no** se hace y por qué: reconstruir el grafo al publicar tiraría los componentes con estado —el
estado caliente de sesión y de visitante, la ventana de deduplicación—, así que un cambio de `retry-after`
vaciaría la memoria de todos los visitantes.

## Constitution Check — re-evaluación después del diseño

Sin cambios: los once principios igual que arriba, con la misma tensión declarada en el III. El diseño la
**acota más** de lo que la spec prometía, y vale decir cómo: lo alcanzado se calcula por hoja, así que un
merchant que declara lo que cambió no ve reiniciada su ventana. La contaminación queda limitada a quien el
cambio efectivamente toca, que es más de lo que el deploy hace hoy —que reinicia cero ventanas y no avisa a
nadie— y más de lo que la alternativa conservadora haría, que reiniciaría todas.

Y el principio X gana algo que conviene registrar: los once sitios que hoy reciben un valor pasan a recibir
un lector, con lo cual **el nivel de plataforma deja de ser una constante del arranque**. Es la misma idea
del principio XI un paso más allá: no alcanza con que el valor esté en configuración si el proceso lo
convierte en constante al arrancar.

## Riesgos

- **Calcular lo alcanzado por campo en vez de por hoja** es el error más fácil y el más caro: deja ventanas
  de medición corriendo sobre un tratamiento que cambió. Mitigado por una prueba con un merchant que
  declara **una** hoja de un objeto y no las otras.
- **Olvidar uno de los once sitios** del nivel de plataforma: quedaría un valor que la API acepta y que el
  sistema sigue leyendo del arranque, que es exactamente la clase de mentira que esta feature viene a
  sacar. Mitigado porque el compilador encuentra cada sitio al cambiar la forma del enlace, y por SC-001,
  que pide una prueba por valor.
- **Romper la forma de lo que el SDK recibe** sin querer: el esquema tiene `additionalProperties: false`.
  Mitigado por la prueba de contrato y por FR-017.
- **Que la invalidación deje una lectura por merchant en el camino de decisión** y eso se note: es el costo
  de un arranque en frío, que ya existe, y SC-006 lo mide contra la misma corrida antes de la feature.
