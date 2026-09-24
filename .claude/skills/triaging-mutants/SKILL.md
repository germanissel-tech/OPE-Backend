---
name: triaging-mutants
description: Works a mutant that survived the mutation gate, in this order - describe the damage the mutant actually does, classify it (real, equivalent, diagnostic-only, runner-specific) before touching anything, then either write the test that fails with it or restructure the code so the mutant cannot exist, and confirm with a narrow re-run instead of the full suite. Use when a mutation run reports survivors, when the mutation job of CI fails, or when asked why a mutant survived and what to do about it. Never change production code only to satisfy the tool.
---

# Un mutante sobrevivió

El gate de mutación dice que un cambio no entra si un mutante de sus propias líneas sobrevive. Un
superviviente no es todavía un defecto de las pruebas: es una pregunta. Esta skill es el orden en
que se responde. **La corrida completa cuesta minutos y no se repite por cada arreglo**, así que
los cuatro pasos están ordenados para no pagarla más de una vez.

## Los cuatro pasos, en este orden

### 1. Describir el daño, antes de opinar

Decir **qué hace distinto el código mutado**, en términos observables: qué entrada produce qué
salida equivocada, o qué invariante deja de sostenerse. Si no se puede escribir esa frase, no se
sabe todavía si el mutante importa, y los pasos 2 y 3 serían adivinanza.

### 2. Clasificarlo, antes de tocar nada

Cuatro clases, y cada una lleva a un paso 3 distinto:

| Clase                 | Qué significa                                                                                | Va al paso 3 como |
| --------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| **real**              | el mutante cambia el comportamiento y ninguna prueba lo nota                                 | una prueba nueva  |
| **equivalente**       | el mutante no cambia el comportamiento: ninguna prueba podría distinguirlo                   | reestructuración  |
| **sólo diagnóstico**  | lo que cambia es un mensaje, un log o una traza que nadie afirma                             | se acepta y se dice por qué |
| **específico del runner** | el mutante no se activa de forma fiable por cómo el runner ejecuta ese código             | se ignora por configuración |

Clasificar **antes** de escribir nada es lo que evita el error caro: escribir una prueba para un
mutante equivalente produce una prueba que afirma la implementación en vez del comportamiento, y
esa prueba vuelve a fallar con el próximo refactor legítimo.

### 3. Actuar según la clase

- **Real** → la prueba que **pasa con el original y falla con el mutante**. Las dos mitades
  importan: una prueba que falla con los dos no distingue nada.
- **Equivalente** → **reestructurar el código para que el mutante no exista**, no agregar una
  excepción. Si dos formas del código no se distinguen, casi siempre una de las dos dice de más:
  una comparación redundante, un default inalcanzable, una rama que otro invariante ya cerró.
  La excepción en línea es el último recurso, y lleva su motivo.
- **Sólo diagnóstico** → excluir ese mutador, con motivo, o dejarlo documentado como aceptado.
- **Específico del runner** → ignorarlo por configuración, con el motivo escrito. **Nunca se
  cambia producción sólo para satisfacer la herramienta.**

### 4. Confirmar acotado, nunca con la corrida completa

Volver a mutar **sólo el archivo (o el rango de líneas) que se tocó**. Es un minuto contra
minutos, y es suficiente: el mutante que se está respondiendo vive ahí. La corrida completa es
trabajo de CI, no de la máquina de quien arregla.

## Lo que no se hace

- Escribir una prueba sin haber clasificado: produce pruebas que afirman la implementación.
- Ampliar una excepción para tapar un mutante real.
- Repetir la corrida completa para verificar un arreglo.
- Cambiar producción para que la herramienta se calle.

## En este repositorio

Los datos concretos, que son lo único propio de acá:

- Confirmación acotada: `npm run test:mutation -- --files <archivo>[:l1-l2]`, con `--force` para
  iterar sobre el mismo superviviente.
- El archivo incremental `reports/mutation/stryker-incremental.json` **no se borra**: la segunda
  corrida re-testea sólo lo que cambió. `npm run test:mutation -- --all` escribe en otro archivo y
  nunca alimenta al gate.
- Excepción en línea: `// Stryker disable next-line <mutador>: <motivo>`.
- La clase «específico del runner» ya está resuelta de forma general por `ignoreStatic`: un mutante
  de código que corre fuera de un `it` no cuenta como superviviente.
- La corrida completa la hace CI en cada push, en su propio job. Es el juez; localmente no se
  espera.
