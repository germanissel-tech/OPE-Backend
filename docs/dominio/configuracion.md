---
es: configuración
en: configuration
contexto: plataforma
estado: aprobado
fuente: constitucion#XI
uso: pendiente
---

# configuración -> `configuration`

> Todo valor que gobierna el comportamiento de OPE es configuración, en tres niveles: lo que define el merchant → si no, el default de tratamiento → nunca una constante del código. — **DECIDIDO** (constitución XI; feature 017)

Se resuelve **valor por valor**: lo que el merchant declaró en su versión vigente; si no, el
default de tratamiento; y encima los valores de plataforma, que ningún merchant sobrescribe.
El resultado es la **configuración efectiva** (`EffectiveConfiguration`), identificada por la
terna de versiones `{ platform, defaults, merchant? }` que cada decisión del ledger estampa.

El nivel merchant se publica por la API de administración como **versiones** numeradas e
inmutables (`MerchantConfigurationVersion`): cada publicación crea una versión nueva; la
anterior sigue consultable; nada se sobrescribe. Contiene lo que el merchant sobrescribe:
estrategia de sincronización por flujo, frescura, reglas del nivel de sincronización, política
de decisión, política comercial, perfil de evidencia, superficies y barreras activas, idiomas y
el mapa de anclajes. Con un experimento activo la configuración está **congelada**
(`configuration-frozen`), salvo una versión declarada correctiva con motivo, que reinicia la
ventana de acumulación (D-G). Ningún cambio requiere reinicio: vale desde la siguiente
solicitud.
