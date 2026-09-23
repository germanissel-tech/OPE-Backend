---
numero: 033
titulo: Grafo de composición tipado
estado: aceptada
fecha: 2026-09-22
fuente: specs/020-grafo-de-composicion/research.md
---

# ADR-033 — Grafo de composición tipado

Enmienda a ADR-013 (anillos, módulos y composición). Lo que ADR-013 decide sobre los anillos, el
mapa de contextos y el composition root único sigue vigente; lo que cambia es **cómo se expresa el
cableado**.

## Contexto

La inyección de dependencias manual de ADR-013 se implementó con una intersección global de puertos
por nombre de clave, una lista de módulos y un perfil que los compone con un spread ordenado a mano.
Medido en `main` (`eb32fc2`), eso dejó tres grafos paralelos escritos a mano: la intersección, la
lista y el spread. El reloj se declara catorce veces y el logger doce; el perfil necesita
envoltorios perezosos para las dependencias cruzadas y un comentario que admite el orden implícito;
los puertos del plano de decisión heredan los de otros cuatro módulos; el acoplamiento entre módulos
de composición no lo juzga ninguna regla, porque consumir algo de otro módulo no era un import.

Un orden equivocado, un puerto sin proveedor o un módulo fuera de la lista no fallaban al compilar:
daban un valor indefinido en ejecución o, en el mejor caso, un error de arranque.

El estado del arte se revisó antes de decidir (research R-02): composición por fábricas con
interfaces angostas del consumidor, capas con los requisitos en el tipo y cobertura verificada por
el compilador, y un caso documentado de dos grafos mantenidos a mano que divergen en silencio. Los
contenedores del ecosistema quedan excluidos por reglas vigentes: decoradores y metadatos reflexivos
están prohibidos (ADR-011, ADR-012) y la resolución por texto también.

## Decisión

El cableado es un **grafo tipado**, con inyección de dependencias manual y sin contenedor.

1. **Un componente se pide por una constante importada, nunca por su nombre.** Su módulo dueño la
   declara una vez y la exporta; quien la necesita la importa. La constante lleva una etiqueta
   legible que viaja en el tipo y sirve **sólo** para los mensajes de error: no se compara nunca, y
   la resolución usa el objeto como clave. Consecuencia buscada: el acoplamiento entre módulos de
   composición vuelve a ser un arco del grafo de imports, y el mapa de contextos pasa a regir
   también en `src/composition/modules/`.
2. **Cada enlace declara de qué depende**, y los tipos del constructor salen de esa declaración.
3. **Los requisitos viajan en el tipo.** No compilan: un despliegue al que le falta un proveedor,
   una tabla de tecnología que no sirve alguno de los puertos que declara, una vista derivada
   enlazada a otra instancia, y un despliegue cuya unión de operaciones servidas no cubre las que el
   contrato declara.
4. **La resolución es perezosa y memorizada**: un componente se construye una vez por arranque y se
   comparte. No hay patrón Singleton ni estado estático: la instancia vive en el grafo de ese
   arranque, y dos arranques no se ven. "Una instancia, dos vistas" se declara como derivación, y no
   con un cierre.
5. **Un ciclo entre proveedores falla al arrancar nombrando el ciclo.** El tipo no puede impedirlo
   de forma practicable; queda como falla de arranque con prueba.
6. **Un módulo de composición dice tres cosas**: lo que **provee** (sus componentes, una tabla de
   enlaces por tecnología), lo que **expone** (lo que arma con ellos, igual en todo despliegue) y lo
   que **sirve** al servidor. Todo opcional: un módulo que no sirve ninguna operación omite esa
   parte. Lo que **necesita** no se declara como lista: son sus imports y los nombres de sus
   enlaces, porque una lista escrita a mano puede quedar vieja y un import no. Una regla de forma
   reporta cualquier otra exportación.
7. **Un despliegue es una lista sin orden significativo** de módulos. Es la única lista:
   desaparecen la intersección global de puertos y la lista de módulos. Un módulo nombra su
   tecnología sólo cuando declara más de una: con una sola no hay decisión, y el compilador hace la
   pregunta el día que existe. Las tecnologías de un módulo tienen que proveer lo mismo, y la que
   se aparta se reporta con lo que le falta.
8. **La verificación de cobertura de operaciones al arrancar se conserva** (constitución II): el
   compilador ve el tipo generado del contrato, no el archivo de contrato que el proceso carga, que
   puede declarar más operaciones que el binario conoce.
9. **Dos verificaciones nuevas** hacen que el camino correcto no sea opcional: una abstracción que
   un módulo de aplicación declara como puerto y ningún módulo enlaza falla el build, y una
   implementación de puerto construida fuera de su enlace la reporta una regla de forma.

## Consecuencias

- Agregar un módulo toca tres archivos —el suyo, el del despliegue y el mapa de contextos— y
  olvidarse de cualquiera falla en compilación o en la verificación de arquitectura, nunca en
  ejecución.
- Agregar una tecnología (la persistencia, cuando llegue) es una tabla de enlaces junto a la de
  memoria y una línea del despliegue; ningún consumidor cambia. Refuerza la constitución X.
- Los mensajes de error del compilador son largos. Se mitigan con alias con nombre que aparecen
  literalmente en el mensaje y con pruebas de tipos que fijan el texto esperado.
- Los únicos `as` de la biblioteca están en un mismo borde, comentado: el que separa una lista
  heterogénea de enlaces y recetas de sus constructores, cuyos parámetros ya verificó quien los
  declaró.
- Es un cambio de una sola vez: los dos mecanismos no pueden convivir sin mantener dos listas, que
  es el defecto que la decisión elimina.

## Alternativas descartadas

- **Un contenedor de DI del ecosistema**: decoradores y metadatos reflexivos (prohibidos por
  `erasableSyntaxOnly`) o resolución por texto (prohibida por esta misma decisión).
- **Adoptar un framework de efectos** para reusar su sistema de capas: obligaría a que los
  constructores devuelvan efectos y reescribiría dominio y aplicación; fuera del alcance.
- **Verificar la cobertura sólo al arrancar** (lo que había): detecta el error cuando el proceso
  corre, no impide escribirlo, y no cubre las pruebas que no arrancan la aplicación.
