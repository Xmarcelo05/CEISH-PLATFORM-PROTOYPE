# CEISH — Documento de Dominio y Flujo (contexto para el agente)

> Este documento describe **qué** hace el sistema y **por qué**, a nivel de negocio.
> El `CLAUDE.md` del repo describe **cómo** está construido técnicamente.
> El agente debe leer ambos documentos antes de proponer o implementar cualquier cambio.
>
> **Fase actual: PROTOTIPO FUNCIONAL.** No es un maquetado estático (no basta con
> que "se vea bien") ni un MVP (no requiere persistencia real ni endpoints
> productivos). Es un prototipo **interactivo**: el flujo completo debe poder
> recorrerse de punta a punta (crear investigación → estratificación → ciclo de
> observaciones → aprobación/baja) y los datos deben comportarse de forma
> consistente entre pantallas (si el investigador crea una investigación, debe
> aparecer en el dashboard; si el revisor emite un anexo, el estado debe
> cambiar en todas las pantallas que lo muestran).
>
> Esto se logra con una **capa de datos compartida simulada** (un store, ej.
> Zustand, que actúa como "backend falso" en memoria del navegador). Esta capa:
> - SÍ debe comportarse como un backend real: crear, leer y actualizar
>   investigaciones/anexos/asignaciones de forma consistente en toda la app.
> - NO persiste al recargar la página (o puede resetearse a datos semilla).
> - NO toca `src/lib/database.ts`, `src/server/`, `docker-compose.yml` ni
>   `database/schema.sql` — eso es trabajo de una fase posterior, cuando se
>   conecte esta misma lógica a los endpoints reales que ya documenta
>   `CLAUDE.md`.
>
> **Alcance funcional de esta fase:** únicamente la rama de investigaciones
> **"sin riesgo"**, de principio a fin. Las ramas de riesgo mínimo / mayor al
> mínimo se mencionan para no perder el contexto general del sistema, pero
> **no se prototipan todavía**.

---

## 1. Roles

| Rol | Alias | Puede hacer |
|---|---|---|
| **investigador** | — | Crear investigaciones, subir documentos/correcciones, ver estado, ver comentarios |
| **docente / revisor / evaluador / "miembro del CEISH"** | son el mismo rol | Revisar investigaciones asignadas, emitir anexos, darse de baja de una asignación por conflicto de interés, ver historial |
| **administrador** | — | Gestionar usuarios (ascender investigador → revisor), asignar/reasignar investigaciones, gestionar anexos/formularios (crear, editar, eliminar), gestionar flujos de revisión completos, aprobar solicitudes de investigador externo |

Reglas de combinación de roles:
- Todo usuario nuevo (no admin) entra como **investigador** por defecto.
- Un **revisor sigue siendo investigador también** (ambas vistas y funcionalidades disponibles para la misma persona).
- El **administrador también puede ser revisor** (tiene ambos paneles).
- El rol no es excluyente: es un conjunto de permisos acumulativos, con "investigador" como base.

## 2. Autenticación (fuera de alcance de esta fase — solo contexto)

- Usuarios ULEAM: login directo vía Microsoft 365 (correo institucional).
- Usuarios externos: se registran, describen su investigación/autores/afiliación; el admin valida si hay convenio institucional o si algún autor pertenece a ULEAM, y aprueba o rechaza la solicitud manualmente. Al aprobar, se habilita la cuenta como investigador normal.
- **Para el prototipo se sigue usando el login/credenciales seed que ya existen. No se implementa esto todavía.**

## 3. Entidades clave (para el modelo de datos mock; no se persiste aún)

- **Investigación**: tema, descripción, autores, tipo de riesgo (sin riesgo / mínimo / mayor al mínimo), código identificador único, estado actual, historial de versiones de archivo, historial de estados por etapa.
- **Miembro CEISH declarado en la investigación**: el investigador marca si algún docente de la plataforma es autor/miembro de su investigación, para excluirlo de la asignación aleatoria (conflicto de interés estructural).
- **Asignación**: investigación ↔ revisor(es). 1 revisor si es "sin riesgo"; 2 revisores si es riesgo mínimo o mayor al mínimo.
- **Anexo (plantilla de formulario)**: número, nombre, tipo de campos (checklist / checklist + comentarios / solo comentarios / solo cumple–no cumple), editable por el admin, exportable a Word/PDF con los valores llenados.
- **Emisión de anexo** (instancia): anexo + investigación + etapa + versión + quién lo emitió + fecha + resultado.
- **Comentario/anotación**: texto + página del PDF + quién lo dejó + a qué anexo/campo pertenece. Todos los roles pueden dejar comentarios (ej. el investigador señala a qué objetivo apunta cada pregunta de su encuesta).
- **Etapa de flujo**: agrupa uno o más anexos; el flujo completo es una secuencia de etapas configurable por el admin (pensando a futuro en otros tipos de documento: tesis, filosóficas, experimentales, etc., cada uno con su propio flujo de anexos).
- **Plazo/deadline**: opcional, asociado a una emisión de anexo o etapa (ej. 30 días para que el investigador corrija). Al vencer sin corrección puede gatillar el Anexo 26 (baja).
- **Cronómetro de ejecución de la investigación**: arranca cuando el documento es aprobado (no antes) y se recalcula automáticamente en cada aprobación.

## 4. Flujo general (rama "sin riesgo" — único alcance de esta fase)

```
1. Investigador crea investigación
   → tema, descripción, autores, tipo de riesgo declarado (sin riesgo / mínimo / mayor)
   → declara si algún miembro CEISH es autor/parte de la investigación
2. Sistema asigna código identificador único
3. Investigador solicita revisión
4. Sistema asigna un revisor ALEATORIO
   (excluye automáticamente a cualquier miembro CEISH declarado como parte de la investigación)

── ETAPA 1: ESTRATIFICACIÓN ──────────────────────────────────
5. Revisor asignado revisa Anexos 1–9 (formulario, ya llenados/adjuntados por el investigador)
6. Revisor confirma o cambia el tipo de riesgo declarado por el investigador
   - Si coincide → avanza
   - Si no coincide → el revisor lo corrige, o devuelve el documento al investigador para que
     ajuste (en CUALQUIER etapa el documento puede regresar a una etapa previa)
   - El formulario de esta etapa usa los campos del Anexo 27 (Estratificación de Riesgos)
7. [Rama "sin riesgo"] Revisor emite Anexo 11: justifica exención de revisión ética
   (no involucra seres humanos → no aplica riesgo mínimo/mayor)
   [Ramas riesgo mínimo/mayor: fuera de alcance de esta fase]
8. El revisor de estratificación puede darse de baja de la investigación por conflicto de
   interés no detectado antes → emite Anexo 23. La investigación se reasigna a otro revisor,
   que CONTINÚA desde el punto donde quedó (no repite la etapa desde cero). El revisor
   anterior queda libre para nuevas asignaciones.

── ETAPA 2: REVISIÓN TÉCNICA (ciclo de observaciones) ────────
9. [Sin riesgo → 1 solo revisor asignado. Riesgo mínimo/mayor → 2 revisores; fuera de alcance
   ahora, pero el modelo de datos debe soportar N revisores por investigación.]
10. Revisor emite Anexo 12 (checklist + campos de detalle/observaciones)
    - Si NO hay observaciones → se emite Anexo 13 (aprobado), notifica al investigador → FIN (aprobado)
    - Si SÍ hay observaciones → pasa al investigador
11. Investigador tiene 30 días (plazo configurable) para subir corrección
    - El archivo anterior NO se borra: se archiva para control de versiones (visible al investigador)
    - Si excede el plazo → se emite Anexo 26 (baja/anulación), el proceso termina.
      Retomar = crear una investigación nueva desde cero.
    - Si corrige a tiempo → vuelve al revisor, se re-emite Anexo 12 con las nuevas indicaciones
12. Este ciclo (Anexo 12 con observaciones ↔ corrección del investigador) se repite hasta que:
    a) Anexo 12 sin observaciones + Anexo 13 (aprobado) → FIN exitoso
    b) El revisor decide dar de baja por exceso de correcciones (3–5 ciclos, a su criterio,
       NO es obligatorio) → Anexo 26 con justificación
```

### Diagrama de estados de una investigación (simplificado, rama sin riesgo)

`creada → estratificación → (sin riesgo confirmado) → revisión técnica (ciclo Anexo 12) → aprobada (Anexo 13) | anulada (Anexo 26)`

En cualquier punto puede haber un salto hacia atrás a una etapa previa (devolución por criterio del revisor).

## 5. Reglas transversales (aplican a todo el flujo)

- **Revisión ciega en ambas direcciones**: el investigador no ve quién es su revisor, y el revisor no ve quién es el investigador.
- **Todo formulario/anexo es configurable por el admin**: tipo de campos (checklist / checklist + comentarios / solo comentarios / cumple–no cumple), y se puede agregar, editar o eliminar un anexo/etapa completa. El flujo de etapas **no debe estar hardcodeado**: es un motor de flujo configurable, aunque en esta fase de prototipo se puede simular con datos fijos.
- **Exportación**: cualquier anexo lleno (con su checklist/comentarios marcados) debe poder descargarse como Word (y PDF) con el formato original del anexo y los valores reflejados.
- **Versionamiento de archivos**: cada corrección sube un nuevo archivo; el anterior se conserva y es visible en el historial, no se borra.
- **Persistencia de progreso**: si un revisor sale de la pantalla de revisión a medias, su progreso (checks marcados, comentarios escritos) debe quedar guardado.
- **Comentarios con ubicación**: los comentarios de revisión están ligados a una página del PDF, y son visibles para el investigador cuando se le devuelve el documento.
- **Fechas y tiempos**: cada acción (subida, corrección, emisión de anexo) guarda su fecha; el cronómetro de ejecución de la investigación arranca solo al aprobarse (no antes) y se recalcula en cada aprobación.
- **Plazos (deadlines) independientes**: el plazo que el administrador le pone al revisor y el plazo que el revisor le pone al investigador **no están relacionados entre sí** — son dos configuraciones independientes, sin validación cruzada.
- **Notificaciones**: solo dentro de la aplicación por el momento (sin correo/push).
- **Extensibilidad a futuro (no construir ahora, pero no bloquear el diseño)**: hoy solo existe el flujo de "investigación normal"; el admin debe poder crear flujos nuevos completos (con sus propios anexos) para otros tipos de documento (tesis, estudios filosóficos, experimentales, etc.), y el investigador elegirá el tipo al subir su documento.

## 6. Catálogo de anexos relevantes para esta fase (rama sin riesgo)

| Anexo | Uso en el flujo |
|---|---|
| 1–9 | Documentación inicial de la investigación (llenados/adjuntados por el investigador), revisados en Etapa 1 |
| 27 | Formulario de Estratificación de Riesgos — Etapa 1 |
| 11 | Carta de exención (investigación sin riesgo) — Etapa 1 |
| 23 | Declaración de conflicto de interés (revisor se da de baja de una investigación) — Etapa 1 |
| 12 | Checklist de evaluación técnica — corazón del ciclo de observaciones en Etapa 2 |
| 13 | Formato de emisión de resolución final (aprobación, con o sin modificaciones menores) — Etapa 2 |
| 26 | Suspensión/revocatoria de la aprobación (baja de la investigación) |

*(El resto del catálogo — anexos para riesgo mínimo/mayor, enmiendas, renovación, informes de avance/fin, caso de estudio — existe y ya se cuenta con los archivos .docx de referencia, pero no se prototipa en esta fase.)*

## 7. Fuera de alcance explícito en esta fase

- Ramas de riesgo mínimo y riesgo mayor al mínimo (2 revisores, otros anexos).
- Autenticación real / Microsoft 365 / flujo de aprobación de investigador externo.
- Motor de flujo configurable real (por ahora se simula con datos fijos en el mock).
- Exportación real a Word/PDF (se puede construir el botón, sin generar el archivo real).
- Notificaciones reales (email, push) — se simula como UI dentro de la app usando la capa de datos compartida.
- Persistencia en PostgreSQL/MinIO de todo lo anterior.

## 8. Reglas de negocio confirmadas

- Si el revisor de Etapa 1 se da de baja y se reasigna, el nuevo revisor **continúa donde quedó** el anterior (no repite la etapa desde cero).
- La revisión es **ciega en ambas direcciones**: investigador no ve revisor, revisor no ve investigador.
- Las **notificaciones** se manejan solo dentro de la app por el momento.
- Los **plazos del administrador (al revisor)** y del **revisor (al investigador)** son **independientes entre sí**, sin validación cruzada.

## 9. Orden sugerido de construcción del prototipo (slices verticales, uno por vez)

1. **Modelo mock de datos**: tipos TypeScript para Investigación, Anexo, Emisión de anexo, Asignación (sin tocar DB real).
2. **Pantalla: Investigador → crear investigación** (formulario: tema, descripción, autores, tipo de riesgo declarado, marcar si algún miembro CEISH es autor).
3. **Pantalla: Dashboard investigador** (lista de investigaciones + estado + código).
4. **Pantalla: Dashboard evaluador** (investigaciones asignadas + cuadro informativo resumen del flujo).
5. **Pantalla: Revisión Etapa 1 — Estratificación** (PDF a la izquierda, formulario Anexo 27 a la derecha).
6. **Pantalla: Revisión Etapa 2 — Anexo 12** (checklist + observaciones, ciclo de corrección).
7. **Pantallas de resolución**: Anexo 11 / 13 (aprobado) y Anexo 26 (baja), como modales o vistas de cierre.
8. **Panel admin**: gestión de anexos/formularios (mock, para validar la UI de "editar campos de un anexo").

Cada punto de esta lista = una tarea independiente para el agente, con un commit propio y revisión antes de avanzar al siguiente.
