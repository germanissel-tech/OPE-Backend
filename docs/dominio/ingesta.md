---
es: ingesta
en: ingest
contexto: ingesta
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#3.2
---

# ingesta -> `ingest`

> Ingesta de eventos del SDK — Recibe, valida contra la lista blanca y deduplica.

Cubre `ingest` (operaciones `ingestEvents`, `IngestResult`) y el módulo `ingestion` del código. Un lote se acepta o se rechaza entero: nada se limpia en silencio (01 §10.3).
