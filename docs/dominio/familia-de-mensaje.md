---
es: familia de mensaje
en: family
contexto: decision
estado: aprobado
fuente: docs/adr/027-seleccion-quality-gate-y-politica-comercial.md
---

# familia de mensaje -> `family`

> Candidatos y claims son vocabulario cerrado de OPE.

El nombre de un candidato, `<barrera>.<anclaje>.<escalón>`, y lo que identifica un texto: una familia
tiene a lo sumo un texto por idioma y capa. Es vocabulario **cerrado** de OPE: la API publica textos
para una familia que ya existe y nunca crea una. Agregar una familia es una feature, no configuración.
