# Data model — 046, los topes de intervención, atómicos

Nada nuevo en el almacén ni en el contrato. Lo único nuevo vive en la memoria del proceso.

## Turno del visitante (en memoria, nuevo)

| qué             | qué es                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| llave           | el merchant y el visitante del lote, en una clave que no se confunde entre merchants |
| último encolado | la decisión que se atiende o espera al final de la fila de ese visitante             |

Existe sólo mientras el visitante tiene un lote en curso o esperando: se crea con el primero y se borra cuando
termina el último. Ninguna regla del dominio cambia: los dos topes siguen siendo los de la política comercial, y se
comparan donde se comparan hoy.
