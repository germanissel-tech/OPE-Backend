---
numero: 25
titulo: Catálogo como snapshot, verdad de producto con frescura por clase y credencial de plataforma
estado: aceptada
fecha: 2026-09-18
fuente: specs/010-catalogo-y-stock/research.md
---

# ADR-025 — Catálogo como snapshot, verdad de producto con frescura por clase y credencial de plataforma

## Contexto

El plano de decisión necesita verdad de producto a nivel de variante (01 §4.3, §8) sin
consultar a la plataforma del merchant en el camino crítico (01 §4.6, 02 §4). El adaptador
genérico (02 §6.2) es lo que cualquier ecommerce puede implementar: empujar su catálogo. Es la
primera operación del consumidor `platform`, cuya credencial ADR-020 dejó propuesta.

## Decisión

1. **Snapshot completo con reemplazo idempotente.** El catálogo entra como una foto completa
   (`PUT /v1/catalog`) con `capturedAt` declarado por la plataforma y `receivedAt` registrado
   por OPE; reemplaza al vigente sin fusión. `capturedAt` es la clave de idempotencia
   (ADR-020, `x-idempotency`): un instante nuevo crea (`201`), el mismo instante con el mismo
   contenido repite (`200`), el mismo instante con otro contenido es `409 idempotency-conflict`
   (error del `shared-kernel`, reutilizable por órdenes y devoluciones), y un instante anterior
   al vigente se rechaza (`422 catalog-out-of-order`). Variantes anidadas en su producto: no
   hay huérfanas por construcción. Invariantes: ids únicos, captura no futura (5 min).
2. **El stock es guardia** (01 §4.3): `available` booleano por variante; ninguna cantidad
   entra ni sale.
3. **Frescura por clase de dato, fail-closed.** Catálogo y variantes valen 36 h; disponibilidad
   y precio 15 min, medidos desde `capturedAt`. Más viejo que el presupuesto de catálogo ⇒ "sin
   verdad" (el consumidor se calla); entre ambos ⇒ la variante existe pero stock y precio se
   reportan viejos (01 §8: calce y atributos sí, disponibilidad y precio no). Los presupuestos
   son políticas de aplicación publicadas en el contrato; pasan a configuración por merchant
   con la 014.
4. **Perfil observado, no declarado** (01 §14.1): el nivel de sincronización (0–3) se deriva de
   la cadencia de recepciones y la edad del vigente en cada consulta; degrada solo; 3 no se
   alcanza con snapshots completos. El mínimo con el nivel configurado y las familias que
   habilita son de la 014.
5. **`platformKey` decidido**: clave servidor a servidor por merchant (una o dos, rotación),
   header `X-OPE-Platform-Key`, configurada en `OPE_MERCHANTS` junto a las de ingesta y
   distinta de ellas; sin CORS; resuelta por un servicio del módulo `merchant` y un security
   handler propios. HMAC del cuerpo: DECIDIDO (stakeholder, 2026-09-18) que entra con el primer
   adaptador real (Magento) o con las órdenes de la 013, lo que llegue primero; hasta entonces la
   clave de plataforma por HTTPS es la única autenticación de la plataforma.
6. **Capacidades verificadas en runtime, de forma genérica**: cada security handler entrega las
   capacidades del consumidor de su credencial (réplica de `api-map.yaml`, verificada por
   prueba) y la infraestructura compara `x-required-capabilities` de la operación antes de
   validar el cuerpo; falta alguna ⇒ `403 capability-missing`.
7. **Headers de credencial desde el cableado**: cada esquema declara su header
   (`SecurityScheme { handler, header }`); los headers admitidos por CORS se derivan de los
   esquemas registrados y el log redacta todo header, con lo que la infraestructura no conoce
   ninguna credencial por nombre. Cierra lo que ADR-020 había dejado propuesto.
8. **`Money`** pasa al `shared-kernel` del dominio como value object (lo comparten ingesta y
   catálogo).

## Consecuencias

- La 011 lee `ProductTruthService` y decide con `freshness` por clase; nunca ve cantidades.
- Un adaptador Magento/VTEX (pull) o un refresco parcial de stock/precio son operaciones
  posteriores del mapa (V3); el snapshot completo es el caso base que todos pueden cumplir.
- Órdenes y devoluciones (013) reutilizan `platformKey` y la verificación de capacidades tal
  cual.
- El `bodyLimit` del servidor sube a 32 MiB (openapi-backend rutea con un handler único; no
  hay límite por operación).
