# Plantilla del informe (`docs/auditoria/2026-09-19-informe-auditoria-integral.md`)

El informe crece por fases; las secciones se crean vacías en la fase 0 con la marca
`(pendiente: fase N)` y cada fase reemplaza la suya. Idioma español; citas de código tal cual.
Sin puntuaciones. Sin las palabras marcador `ABIERTO`/`PLACEHOLDER` (R-08).

```markdown
# Informe — auditoría integral del backend de OPE (features 001–013)

**Fecha**: 2026-09-19 · **Alcance**: `main` en `8d12aa2` · **Método**: specs/014-auditoria-integral/
**Estado global**: <rejected | changes-required | approved> ← §7

## 1. Alcance y método (fase 0; se completa en 5)

- Qué se leyó (documentos, ADRs, specs, módulos) con fecha y sesión.
- Qué se corrió: comando, fecha, dónde está la salida (`trabajo/gates/…`), resumen de una línea.
- Qué no se pudo verificar y por qué.
- Cómo leer un hallazgo (campos, severidad derivada, refutación).

## 2. Gates (hechos) (fase 0 global; fase 1 por módulo)

### 2.1 Globales — tabla comando → resultado → archivo de salida

### 2.2 Por alcance — 14 filas: alcance → lint/arch/shape/duplication/dead-code/language → hallazgos del gate

## 3. Hallazgos confirmados (fases 1–4)

Por dimensión y, dentro de cada una, por severidad (high → medium → low). Cada hallazgo:
`F-NNN` · `file:line` · cita · regla y fuente · severidad · propuesta before/after · prueba que lo cubriría.

### 3.A Clean architecture, SOLID y lectura fina (fase 1)

#### Cuadro por módulo — 14 filas × 7 ejes: lista de F-NNN o "sin hallazgos"

### 3.B Robustez (fase 2)

### 3.C Escalabilidad y camino a la 017 (fase 3)

### 3.D Seguridad (fase 3)

### 3.E Calidad de las pruebas (fase 3)

### 3.F Cumplimiento funcional (fase 4)

Sospechas del handoff: S-01…S-12 con veredicto y F-NNN o motivo.

## 4. Matriz de cumplimiento (fase 4)

### 4.1 Constitución I–X — principio → evidencia (prueba/gate con ruta) o hueco

### 4.2 Criterios de aceptación 03 §10 — uno por fila

### 4.3 Documentos del MVP — 01 §4/5/6/9/10, 02 §4/5, 03 §4.5/4.7/4.8/4.11/6 — afirmación → evidencia o hueco

### 4.4 Specs 001–013 — FR/SC → evidencia o hueco (una tabla por feature)

## 5. Refutados (anexo) (fase 5)

`F-NNN` · dónde nació · refutación.

## 6. Riesgos para la 014–017 (fases 2–3; cierre en 5)

Riesgo · `file:line` del supuesto · feature que lo absorbe.

## 7. Estado global (fase 5)

Regla aplicada: gates bloqueantes en rojo = N; hallazgos high = N, medium = N, low = N ⇒ estado.
```
