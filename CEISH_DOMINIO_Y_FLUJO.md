# CEISH — Documento de Dominio y Flujo (v3 — Motor Configurable)

> Este documento describe **qué** hace el sistema y **por qué**, a nivel de negocio.
> El `CLAUDE.md` del repo describe **cómo** está construido técnicamente.
> El agente debe leer ambos documentos antes de proponer o implementar cualquier cambio.
>
> **Cambio de fondo respecto a v2:** lo que antes era "fuera de alcance para
> esta fase" (un motor de flujo configurable por el admin) ahora es el
> **núcleo del sistema**. El flujo de "Investigación sin riesgo" que ya se
> había construido (tipos, store, pantallas de investigador y revisor) **no
> se descarta**: se migra para convertirse en el primer **tipo de documento**
> configurado dentro de este motor nuevo, usando los mismos anexos (1-9, 11,
> 12, 13, 23, 26, 27) reorganizados en 3 etapas explícitas.
>
> **Fase actual: PROTOTIPO FUNCIONAL.** Interactivo, con una capa de datos
> compartida simulada (Zustand + `persist` en `localStorage`, clave
> `ceish-prototype-storage`). No toca `src/lib/database.ts`, `src/server/`,
> `docker-compose.yml` ni `database/schema.sql`.
>
> **Alcance funcional de esta fase:** el motor configurable completo (tipos
> de documento, secciones, anexos, preguntas) + el flujo de "Investigación"
> ya construido, migrado a ese motor. Los demás tipos de documento (Tesis,
> Artículo científico, etc.) son casos de uso que el admin **podrá crear**
> con el motor, pero no vienen predefinidos más allá de "Investigación".

---

## 1. Roles y Acumulación de Permisos

| Rol | Alias | Puede hacer |
|---|---|---|
| **investigador** | — | Crear documentos, llenar anexos de su rol, subir versiones, ver estado, ver observaciones |
| **docente / revisor / evaluador / "miembro del CEISH"** | mismo rol | Revisar documentos asignados, llenar anexos de su rol, escalar al admin, devolver al investigador, darse de baja por conflicto de interés |
| **administrador** | — | Todo lo anterior (puede ser revisor también) + gestionar usuarios + **motor configurable** (tipos de documento, secciones, anexos, preguntas) + resolver escalamientos + mensajería |

Reglas de combinación y herencia de roles (Acumulación):
- **Investigador (`student`)** es la base de todos los usuarios en la plataforma.
- **Revisor/Evaluador (`evaluator`)** hereda los permisos de Investigador (acumula ambos roles: puede registrar y llenar sus propios proyectos, y a la vez revisar otros proyectos asignados ciegamente).
- **Administrador (`admin`)** hereda acumulativamente todos los roles (Investigador + Revisor + Administrador).

## 2. Autenticación (fuera de alcance de esta fase — sin cambios)

## 3. El motor configurable — conceptos nuevos

Esta es la pieza central de la v3. Reemplaza la idea de "formularios puros en HTML" por un motor basado en **plantillas de Word oficiales (.docx) rellenadas mediante variables**:

```
Tipo de Documento (ej. "Investigación", "Tesis", "Artículo científico")
  └─ Sección / Etapa (ej. "Creación", "Estratificación", "Evaluación")
       └─ Anexo (asociado a una plantilla Word .docx oficial)
            └─ Variable / Campo (Etiqueta, Tipo de Entrada, Tag de Word {tag})
```

**Reglas de este motor:**

- **Los anexos son reutilizables entre tipos de documento.** El admin asocia una plantilla de Word `.docx` al Anexo 27 y puede reutilizarla en múltiples flujos.
- **El orden de los anexos dentro de una sección es solo visual/de presentación.** El usuario puede saltar libremente entre ellos — no hay bloqueo secuencial estricto.
- **Cada anexo se marca como obligatorio u opcional** al crearlo (ej. Anexo 23 es opcional — solo se llena si hay conflicto de interés).
- **Cada anexo tiene un rol asignado** (Investigador o Evaluador) — determina quién lo ve/llena.
- **Una sección se puede "completar"** cuando todos sus anexos obligatorios fueron guardados al menos una vez; los opcionales no bloquean el avance. El botón "Completar etapa" se activa solo bajo esa condición.
- **El admin diseña las variables de entrada de cada anexo** indicando la etiqueta visual del formulario, el tipo (checklist / texto libre / archivo) y el **Tag de Word** exacto (ej. `{nombre_investigador}`) que reside en el documento físico subido.
- **Comportamientos especiales por anexo (ej. Anexo 23 dispara reasignación de evaluador) se programan a mano, caso por caso** — no existe (por ahora) un sistema genérico donde el admin configure "qué acción dispara este anexo".
- **Progreso persistente:** los formularios guardados se mantienen aunque el usuario salga de la etapa sin completar todos los anexos.

### Migración del flujo "Investigación" a este motor

El tipo de documento "Investigación" queda configurado (como dato semilla) con esta estructura — es la reorganización del flujo que ya se había construido, ahora expresada como configuración en vez de código hardcodeado:

```
Tipo de Documento: "Investigación"

  Etapa 1: Creación de Investigación          [todos los anexos: rol Investigador]
    - Anexo 1 al Anexo 9 (obligatorios, plantilla Word + variables)

  Etapa 2: Estratificación                    [todos los anexos: rol Evaluador]
    - Anexo 27: Estratificación de Riesgo (obligatorio, plantilla Word + variables)
    - Anexo 11: Carta de Exención (obligatorio — se llena si el riesgo es "sin riesgo")
    - Anexo 23: Conflicto de Intereses (opcional — solo si aplica)

  Etapa 3: Evaluación                         [todos los anexos: rol Evaluador]
    - Anexo 12: Evaluación de Proyecto (obligatorio, se repite por ronda)
    - Anexo 13: Resoluciones / Aprobación (obligatorio al cerrar)
    - Anexo 26: Suspensión de Proyecto (opcional — a criterio del evaluador)
```

**Nota importante:** el "tipo de riesgo" (sin riesgo / mínimo / mayor) **ya no es un campo especial hardcodeado del sistema** — es, en la práctica, una consecuencia de que el tipo de documento incluya o no el Anexo 27 en su configuración. Si el admin crea un tipo de documento sin ese anexo, ese tipo simplemente no maneja estratificación de riesgo. El campo de riesgo vive dentro de las respuestas del Anexo 27, no como una propiedad aparte de `Investigacion`.

## 4. Entidades clave (modelo de datos actualizado)

- **TipoDocumento**: id, nombre (ej. "Investigación", "Tesis"), lista ordenada de `Seccion`.
- **Seccion** (etapa): id, nombre, orden, lista de `AnexoAsignado` (referencia a un `AnexoTemplate` + flag `obligatorio`).
- **AnexoTemplate**: id, número, nombre, rol (`investigador` | `evaluador`), wordTemplateName (nombre del archivo .docx), wordTemplateBase64 (contenido binario del Word en base64), lista de `Pregunta` (variables).
- **Pregunta** (Variable): id, key (tag de Word {tag} a reemplazar), texto (etiqueta del formulario), tipo (`checklist` | `texto-libre` | `archivo` | `si-no`), descripción/contexto opcional, orden.
- **Documento** (antes `Investigacion`, generalizado): id, código único, `tipoDocumentoId`, tema, descripción, autores (por cédula), investigadorId, miembrosCeishDeclarados, estado, versionesArchivo, historialEstados, cronómetro.
- **Autor**: cédula (identificador principal), nombre (autocompletado si la cédula corresponde a un usuario registrado; si no, queda solo la cédula).
- **RespuestaAnexo** (antes `EmisionAnexo`, generalizado): id, `anexoTemplateId`, `documentoId`, `seccionId`, versión de archivo asociada, quién la llenó, fecha, respuestas por pregunta, resultado/acción disparada si aplica, **snapshot congelado** de las preguntas tal como estaban al momento de guardar (para auditoría — ver sección 8).
- **Asignación**: documentoId, evaluadorId, tipo de sección, activo, motivo de baja si aplica.
- **Escalamiento**: id, respuestaAnexoId adjunta (puede estar vacía/sin llenar), comentario del evaluador, estado (pendiente/resuelto), edición del admin (que se vuelve el registro oficial), notificación al evaluador.
- **Notificación**: id, tipo (`automatica` | `manual`), destinatario(s), mensaje, leída/no leída, fecha.

## 5. Flujo general — instancia "Investigación" (ejemplo sobre el motor)

```
1. Investigador inicia la creación de un nuevo proyecto en el modal.
2. Selecciona el Tipo de Documento (flujo configurado por el admin, e.g. "Investigación").
3. Completa los metadatos generales (Tema, descripción, co-autores por cédula).
   → El sistema autocompleta el nombre del co-autor si la cédula está registrada en el sistema.
   → Si la cédula corresponde a un evaluador, se marca conflicto automáticamente.
4. El sistema despliega un wizard con pestañas horizontales para rellenar los anexos obligatorios de la Etapa 1 (Anexo 1 al Anexo 9). El investigador navega libremente respondiendo las preguntas.
5. El investigador sube el archivo PDF del protocolo (máx. 15MB).
6. Una vez completados todos los anexos obligatorios de Etapa 1 y subido el PDF, se habilita el botón "Registrar Proyecto y Solicitar Revisión".
7. El registro genera un código único, guarda las respuestas y realiza la transición a Estratificación (Etapa 2, estado `estratificacion`), asignando ciegamente a un evaluador sin conflictos.

── ETAPA 2: ESTRATIFICACIÓN ──────────────────────────────────
6. Evaluador revisa los Anexos 1-9 del Investigador.
7. Evaluador llena Anexo 27 (Estratificación) — obligatorio. Al confirmar la Estratificación del proyecto (Exención Ética), el sistema guarda el Anexo 27 y redirige automáticamente a la pestaña del Anexo 11 (Carta de Exención) sin avanzar el proyecto de etapa.
8. Evaluador llena Anexo 11 (Exención) — obligatorio. El botón para pasar el proyecto a la etapa de Revisión Técnica se activa únicamente si Anexo 27 está completo y si se llenan los campos obligatorios de tipo texto-libre (justificación técnica de exención). Los checklists y otros campos son opcionales.
9. [Opcional] Evaluador llena Anexo 23 (Conflicto de Interés) — se activa solo si Anexo 27 está completo, Anexo 11 está válido y se describe la causa del conflicto en el formulario del Anexo 23. Al confirmar, el revisor queda desligado y el trámite avanza a Revisión Técnica (`revision-tecnica`) reasignando ciegamente a un nuevo evaluador en la sección técnica (`sec-evaluacion`).
10. El evaluador puede devolver el documento al investigador en cualquier punto (con justificación obligatoria) o escalar al admin.
11. Todos los botones de confirmación o de paso de etapa requieren una doble confirmación (`window.confirm`).

── ETAPA 3: EVALUACIÓN (ciclo de observaciones) ──────────────
12. Evaluador llena Anexo 12 (Evaluación de Proyecto).
    - Con observaciones → agrega comentarios por página del PDF (editables y eliminables en caliente) y devuelve el proyecto al investigador (con confirmación obligatoria), regresándolo a estado Borrador para correcciones.
    - Sin observaciones → al confirmar la Aprobación Técnica del Anexo 12 (activable solo si las observaciones generales obligatorias están llenas), se emite el anexo 12 y se redirige automáticamente al Anexo 13 (Resolución de Aprobación Final).
13. En el Anexo 13, el botón "Emitir Resolución y Aprobar Proyecto" se habilita únicamente si el Anexo 12 fue aprobado y se llenan los campos obligatorios del Anexo 13. Al confirmarlo (con doble confirmación), se finaliza el trámite y pasa a estado `aprobada`.
14. [Opcional] Anexo 26 (Suspensión/Baja) en la pestaña del Anexo 26 → se activa con justificación técnica, y requiere una confirmación de advertencia especial: el documento pasa a estado `anulada`.
15. El investigador sube correcciones tras devoluciones, iniciando una nueva ronda de revisión ligada al mismo evaluador.
```

## 6. Reglas transversales (actualizadas)

- **Revisión ciega en ambas direcciones** (sin cambios).
- **Notificaciones automáticas** (eventos del sistema: documento devuelto, anexo actualizado por el admin, escalamiento resuelto, etc.) **son un canal separado** de la **mensajería manual del admin** (mensajería libre, puede seleccionar uno o varios destinatarios, sin plantillas).
- **Versionamiento**: cada corrección del investigador crea una nueva `VersionArchivo`; el anterior se conserva.
- **Plazos independientes** entre admin→evaluador y evaluador→investigador (sin cambios de v2).
- **Sin backend/DB real** en esta fase (sin cambios).

## 7. Congelamiento y auditoría (reglas nuevas — importantes)

Esta es la parte más delicada del sistema, resumida en una tabla de decisión:

| Evento | ¿Qué pasa con las respuestas ya dadas? |
|---|---|
| Admin edita el **texto** de una pregunta, documento **en proceso** (sin Anexo 13 emitido) | La respuesta existente a esa pregunta se **elimina**; se notifica automáticamente a los evaluadores involucrados |
| Admin **elimina** una pregunta, documento en proceso | Se elimina la pregunta y su respuesta asociada |
| Admin edita/elimina una pregunta, documento **ya cerrado** (Anexo 13 emitido) | **No afecta nada** — el `RespuestaAnexo` queda congelado tal como estaba al momento de la aprobación, para siempre |
| Una sección ya fue marcada "completa" y el admin edita una de sus preguntas obligatorias | La sección **vuelve a estar "incompleta"**, salvo que el documento ya tenga Anexo 13 emitido (en cuyo caso no cambia nada) |
| Admin modifica un anexo de la Etapa 1 (los que llena el investigador) | La modificación **solo aplica a documentos nuevos** creados desde ese momento — los ya existentes no se ven afectados |
| Cualquier `RespuestaAnexo` ya guardada, en cualquier estado (incluidas rondas con observaciones ya superadas) | Guarda un **snapshot de las preguntas tal como estaban al momento de responder**, para que el historial de auditoría sea fiel a lo que realmente se preguntó, independientemente de ediciones futuras al `AnexoTemplate` |

## 8. Escalamiento al administrador

- El evaluador puede escalar **cualquier anexo de la etapa actual** (llenado o vacío) junto con un comentario, para pedir opinión del admin.
- El admin **edita directamente** ese anexo; su edición **se convierte en el registro oficial** (no es una nota paralela).
- El **evaluador ve la edición del admin y es notificado automáticamente** del cambio.
- El proceso **sigue corriendo en paralelo**: el evaluador puede seguir trabajando en otros anexos de la misma etapa mientras espera resolución del escalamiento.

## 9. Devolución al investigador

- El evaluador puede devolver el documento en cualquier punto de una etapa, con un comentario de justificación obligatorio.
- Puede adjuntar **cualquier anexo de esa etapa como referencia de solo lectura**, esté completado o no.
- El investigador ve el anexo adjunto (si lo hay) + el comentario, corrige lo que corresponda, y reenvía.

## 10. Autoría por cédula

- El campo de autor usa **cédula como identificador principal** (reemplaza el nombre como dato de entrada).
- Si la cédula corresponde a un usuario registrado, **el sistema autocompleta el nombre** automáticamente.
- Si la cédula no está registrada, **queda solo el número**, sin nombre asociado.
- La detección de conflicto de interés (miembro CEISH declarado) se hace **cruzando automáticamente** cada cédula de autor contra los usuarios registrados con rol evaluador — si no hay coincidencia, **se deja pasar sin conflicto detectado** (no se pide dato adicional).

## 11. Catálogo de anexos (sin cambios respecto a v2, ahora expresado como `AnexoTemplate`)

| Anexo | Rol | Sección (tipo "Investigación") | Obligatorio |
|---|---|---|---|
| 1–9 | Investigador | Etapa 1: Creación | Sí |
| 27 | Evaluador | Etapa 2: Estratificación | Sí |
| 11 | Evaluador | Etapa 2: Estratificación | Sí |
| 23 | Evaluador | Etapa 2: Estratificación | No |
| 12 | Evaluador | Etapa 3: Evaluación | Sí |
| 13 | Evaluador | Etapa 3: Evaluación | Sí |
| 26 | Evaluador | Etapa 3: Evaluación | No |

*(El resto del catálogo — anexos de riesgo mínimo/mayor, enmiendas, renovación, informes, caso de estudio — puede incorporarse después creando sus propios `AnexoTemplate` y agregándolos a un `TipoDocumento`, sin cambios de código, una vez el motor esté construido.)*

## 12. Fuera de alcance explícito en esta fase

- Contenido real de las preguntas de cada anexo extraído automáticamente de los `.docx` — **se descartó ese enfoque**; el admin crea las preguntas manualmente en el motor.
- Ramas de riesgo mínimo/mayor con 2 evaluadores (siguen sin desarrollarse operativamente, aunque el motor ya no las excluye estructuralmente).
- Autenticación real / Microsoft 365.
- Exportación real a Word/PDF.
- Persistencia en PostgreSQL/MinIO real.
- Sistema genérico de "qué acción dispara qué anexo" (se programa a mano, caso por caso).

## 13. Reglas de negocio confirmadas (registro de decisiones)

- El tipo de riesgo puede aplicar a cualquier tipo de documento; si el admin no lo quiere, simplemente no incluye el Anexo 27 en ese tipo.
- Los anexos son reutilizables entre tipos de documento.
- El orden de anexos es visual, no bloqueante — se puede saltar libremente.
- Una etapa se completa cuando todos sus anexos obligatorios están guardados; los opcionales no bloquean.
- El ciclo de observaciones de la Etapa 3 funciona igual que en v2 (nueva `RespuestaAnexo` por ronda, nunca se edita la anterior).
- Comportamientos especiales por anexo (ej. Anexo 23 → reasignación) se programan a mano.
- Se puede adjuntar a una devolución cualquier anexo de la etapa, completado o no.
- La edición del admin sobre un anexo escalado es el registro oficial; el evaluador es notificado.
- El proceso sigue en paralelo durante un escalamiento.
- La cédula reemplaza el nombre como dato de entrada de autor, con autocompletado si el usuario existe.
- Sin coincidencia de cédula, no se detecta conflicto de interés (no se pide dato adicional).
- Documentos cerrados (Anexo 13 emitido) quedan congelados para siempre ante cualquier edición futura de preguntas/anexos.
- Documentos en proceso: editar el texto de una pregunta elimina la respuesta existente y notifica a los evaluadores; una etapa ya completa vuelve a quedar incompleta si se edita una de sus preguntas obligatorias (salvo que el documento ya esté cerrado).
- Modificar un anexo de Etapa 1 solo afecta documentos nuevos, no los existentes.
- Notificaciones automáticas (eventos del sistema) y mensajería manual del admin (libre, multi-destinatario) son canales separados.

## 14. Orden sugerido de construcción del prototipo (slices verticales, migración)

1. **Modelo de datos generalizado**: `TipoDocumento`, `Seccion`, `AnexoTemplate` (generalizado con `Pregunta[]`), `Documento` (renombrado de `Investigacion`), `RespuestaAnexo` (renombrado de `EmisionAnexo`, con snapshot de preguntas). Migración de los tipos existentes de la Fase 1 sin romper lo ya construido — **agregar, no reemplazar de golpe**.
2. **Motor configurable del admin — CRUD de Anexos y Preguntas**: crear/editar/eliminar `AnexoTemplate`, agregar preguntas de los 3 tipos, con reglas de congelamiento aplicadas desde el inicio (aunque simplificado: primero que funcione crear/editar, después afinar el congelamiento).
3. **Motor configurable del admin — CRUD de Tipos de Documento y Secciones**: crear un `TipoDocumento`, agregar secciones, asignar anexos existentes a cada sección (reutilizables), marcar obligatorio/opcional y el rol.
4. **Seed**: configurar "Investigación" como el primer `TipoDocumento` usando el motor recién construido, con sus 3 etapas y 7 anexos (según la sección 5 de este documento) — reemplaza el hardcodeo anterior.
5. **Investigador — crear documento**: selector de tipo de documento, autoría por cédula con autocompletado y detección de conflicto de interés, navegación libre entre anexos de Etapa 1, botón "Completar etapa" condicionado a obligatorios. **Corregir además el bug de navegación (falta botón de volver atrás)**.
6. **Investigador — dashboards separados**: pantalla de "todas las revisiones y estados con fecha" y pantalla de "tareas pendientes" (documentos devueltos), como vistas independientes.
7. **Evaluador — revisión dinámica por anexo**: interfaz que ya no asuma Anexo 11→12 fijo, sino que recorra los anexos de la sección actual según la configuración del `TipoDocumento`, con navegación libre entre ellos y guardado independiente por anexo.
8. **Evaluador — devolución y escalamiento**: devolver al investigador (adjuntando cualquier anexo de la etapa) y escalar al admin (con proceso corriendo en paralelo).
9. **Admin — resolución de escalamientos**: bandeja de escalamientos pendientes, edición del anexo escalado, notificación automática al evaluador.
10. **Notificaciones**: automáticas (eventos) + mensajería manual multi-destinatario del admin.
11. **Investigar y corregir el bug de asignación automática** que no aparece en el panel del evaluador (reportado, causa aún no confirmada).

Cada punto = una tarea independiente, con plan antes de código y commit propio, igual que en las fases anteriores.

## 15. Módulo de Seguimiento de Proyectos y Descarga de Actas (Revisor)
- **Dashboard de Asignaciones**: El evaluador cuenta con una vista consolidada de todos sus proyectos a cargo.
- **Línea de Tiempo Visual**:
  - Representa gráficamente cada sección/etapa configurada en el workflow.
  - Colores distintivos: verde para completadas (excedidas o cerradas), naranja para la etapa activa actual del documento, y gris para las etapas pendientes.
  - Despliega las fechas exactas de entrada (cuando el documento cambió a ese estado) y salida (cuando avanzó al siguiente estado).
  - Enlista cada uno de los anexos del trámite con su estado actual (Listo / Pendiente) y su nivel de obligatoriedad.
  - Muestra un contador numérico con el total de devoluciones para corrección del documento.
- **Descargas en Formato de Plantilla Word (.docx)**:
  - Generación en caliente utilizando la utilidad central `generateDocx` y `docxtemplater`.
  - Los anexos que ya fueron completados y guardados/emitidos habilitan un botón dinámico para descargar el documento `.docx` relleno.
  - Los anexos pendientes o no completados muestran el botón deshabilitado e inactivo, garantizando la consistencia documental.

