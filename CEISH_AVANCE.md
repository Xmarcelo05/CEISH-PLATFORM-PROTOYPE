# Control de Avance — Prototipo Funcional CEISH (v3)

Este documento registra de forma detallada el progreso, las decisiones de diseño y las tareas completadas durante la implementación del prototipo funcional de la plataforma CEISH bajo la arquitectura de **Motor Configurable de Workflows**.

---

## 🎯 Objetivo General
Construir un prototipo funcional interactivo basado en un **motor de workflows configurable**, donde el administrador pueda definir dinámicamente Tipos de Documento, Secciones/Etapas, Anexos reutilizables y sus correspondientes preguntas. El flujo de "Investigación" pasa a ser la primera configuración semilla del sistema, simulando los datos en Zustand + localStorage.

---

## 📅 Estado de las Tareas (Roadmap de Implementación)

### 🧱 Fase 1: Cimientos y Capa de Datos (Generalizado)
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **1.1 Definición de Tipos** | ✅ Completado | Modelos generalizados (`Documento`, `RespuestaAnexo`, `TipoDocumento`, `Seccion`, `Pregunta`, `Autor`, `Escalamiento`, `Notificacion`) en [platform.types.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/types/platform.types.ts). |
| **1.2 Acciones CRUD de Configuración y Seed Dinámico** | ✅ Completado | Acciones CRUD creadas en [ceishStore.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/store/ceishStore.ts) (`crearAnexoTemplate`, `crearTipoDocumento`, etc.) y seed de "Investigación" orquestado secuencialmente a través de ellas. |
| **1.3 Panel Admin: CRUD de Anexos y Preguntas** | ✅ Completado | Pantalla de gestión interactiva [AnexoTemplateCRUD.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/admin/components/AnexoTemplateCRUD.tsx) para crear/editar/eliminar anexos y preguntas de 3 tipos. |
| **1.4 Panel Admin: CRUD de Tipos de Documento** | ✅ Completado | Pantalla de gestión interactiva [TipoDocumentoCRUD.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/admin/components/TipoDocumentoCRUD.tsx) para crear flujos, etapas/secciones y asociar plantillas. |

### 📝 Fase 2: Interfaz del Investigador Dinámica
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **2.1 Autores por Cédula y Conflicto Automático** | ✅ Completado | Captura de autores por cédula con autocompletado en [CrearInvestigacionModal.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/components/CrearInvestigacionModal.tsx), detectando de forma automática a evaluadores registrados para conflicto. |
| **2.2 Formulario de Llenado Dinámico** | ✅ Completado | Renderizado dinámico de los anexos obligatorios/opcionales de la Etapa 1 según el `TipoDocumento` y navegación libre en [SubmissionPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/SubmissionPage.tsx). |
| **2.3 Subida de Correcciones en Rondas** | ✅ Completado | Caja de subida de PDF correctivo y justificación en [SubmissionPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/SubmissionPage.tsx) si el revisor devolvió con observaciones (`con-observaciones`) en `'revision-tecnica'`. |

### 🔍 Fase 3: Interfaz del Revisor Dinámica
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **3.1 Dashboard de Evaluaciones Ciega** | ✅ Completado | Listado de asignaciones activas filtradas por revisor y etapa, con estricta ocultación de la identidad de los autores en [EvaluatorDashboard.tsx](file:///C:/Users/PC/Desktop/CHEISH Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/EvaluatorDashboard.tsx). |
| **3.2 Evaluación Dinámica Split-Screen** | ✅ Completado | Carga dinámica de pestañas de anexos y preguntas según la sección activa del trámite. Integración con `<PDFViewer>` y cache de sesión en [ReviewCeishPage.tsx](file:///C:/Users/PC/Desktop/CHEISH Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/components/ReviewCeishPage.tsx). |
| **3.3 Historial de Rondas y Anotaciones por Página** | ✅ Completado | Bandeja de observaciones específicas por página del PDF (Anexo 12) y panel visual del histórico de observaciones de versiones de archivo anteriores en [ReviewCeishPage.tsx](file:///C:/Users/PC/Desktop/CHEISH Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/components/ReviewCeishPage.tsx). |
| **3.4 Disparadores de Acciones Especiales** | ✅ Completado | Acciones programadas a mano: Carta de exención (Anexo 11), inhibición/reasignación por conflicto (Anexo 23), aprobación (Anexo 13) y suspensión (Anexo 26) en [ReviewCeishPage.tsx](file:///C:/Users/PC/Desktop/CHEISH Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/components/ReviewCeishPage.tsx). |

---

## 📝 Registro de Sesiones e Hilos de Trabajo

### Sesión 1: Alineación del Repositorio y Diseño del Plan
* **Fecha:** 2026-07-08
* **Actividades:**
  * Verificación directa en el código de los mecanismos de autenticación (sin JWT) y backend (Vite middleware).
  * Confirmación del esquema activo en PostgreSQL (`database/schema.sql`).
  * Clasificación de archivos legacy frente a los nuevos que se van a agregar.
  * Creación del archivo de seguimiento [CEISH_AVANCE.md](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/CEISH_AVANCE.md).
  * **Tarea 1.1 completada:** Adición de tipos TypeScript específicos para el Motor Configurable en [platform.types.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/types/platform.types.ts).
  * **Tareas 1.2, 1.3 y 1.4 completadas:** Implementación de acciones CRUD dinámicas y seed atómico por helpers puros en el store de Zustand [ceishStore.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/store/ceishStore.ts). Creación y estilizado de las pantallas de administración interactiva [AnexoTemplateCRUD.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/admin/components/AnexoTemplateCRUD.tsx) y [TipoDocumentoCRUD.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/admin/components/TipoDocumentoCRUD.tsx). Integración de rutas en el panel y sidebar de navegación de administrador en [AppShell.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/components/AppShell.tsx) y en el [router](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/app/router/index.tsx).
  * **Tareas 2.1, 2.2 y 2.3 completadas:** Migración de la interfaz del Investigador. Autocompletado de co-autores por cédula con detección de conflictos en [CrearInvestigacionModal.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/components/CrearInvestigacionModal.tsx). Formulario de llenado dinámico de anexos (1 a 9) condicionado a obligatoriedad para el envío de revisión, y adición del panel de subida de PDF correctivo ante observaciones técnicas metodológicas en [SubmissionPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/SubmissionPage.tsx).
  * **Mejoras de Integración de Flujo (Solicitud de Usuario):**
    * Integración del llenado de formularios de la Etapa 1 directamente en [CrearInvestigacionModal.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/components/CrearInvestigacionModal.tsx) a través de un wizard con barra de navegación horizontal por pestañas y validación de obligatoriedad antes de registrar. Selección dinámica del tipo de documento a partir de los flujos configurados por el admin.
    * Transición directa al estado de Estratificación (Etapa 2) con asignación ciega de evaluador al registrar el proyecto.
    * Organización del panel del Evaluador en [EvaluatorDashboard.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/EvaluatorDashboard.tsx) en 3 pestañas: Pendientes (revisiones activas), Suspendidas (proyectos anulados) y Completadas (proyectos aprobados) con contadores dinámicos.
    * Adición de una pestaña de lectura **"Llenado Investigador (Etapa 1)"** en [ReviewCeishPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/components/ReviewCeishPage.tsx) para que el evaluador pueda auditar las respuestas del investigador.
    * Corrección de maquetación en la pantalla de evaluación dividida en [ReviewCeishPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/evaluator/components/ReviewCeishPage.tsx), alineando el visor de PDF al lado izquierdo (`eval-pdf-panel`) y el panel de criterios al derecho (`criteria-panel`).
    * Solución de usabilidad agregando barras de desplazamiento vertical automáticas (`overflowY: 'auto'`) al panel de revisión y líneas divisoras claras con sombreado lateral para evitar redimensionar o alejar el zoom de la pantalla.
    * Implementación de la lógica de **roles acumulativos/heredados** en [AppShell.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/components/AppShell.tsx) permitiendo a Revisores y Administradores acceder fluidamente a las funciones de las jerarquías inferiores (ej. Revisor puede registrar e investigar sus propios proyectos, y Admin puede evaluar y revisar asignaciones).




