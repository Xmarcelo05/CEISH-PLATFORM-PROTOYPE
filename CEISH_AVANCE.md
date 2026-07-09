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
| **2.1 Autores por Cédula y Conflicto Automático** | ⏳ Pendiente | Captura de autores por cédula con autocompletado en `CrearInvestigacionModal`, detectando automáticamente si son evaluadores del CEISH para marcarlos en conflicto. |
| **2.2 Formulario de Llenado Dinámico** | ⏳ Pendiente | Renderizado dinámico de anexos obligatorios/opcionales de la Etapa 1 según el `TipoDocumento`. Navegación libre. Botón "Completar" condicionado a obligatorios. |
| **2.3 Subida de Correcciones en Rondas** | ⏳ Pendiente | Habilitar subida de un nuevo PDF correctivo desde el dashboard si el revisor devolvió con observaciones (`con-observaciones`) en `'revision-tecnica'`. |

### 🔍 Fase 3: Interfaz del Revisor Dinámica
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **3.1 Dashboard de Evaluaciones Ciega** | ⏳ Pendiente | Listado de asignaciones activas filtradas por revisor y etapa, con estricta ocultación de la identidad de los autores. |
| **3.2 Evaluación Dinámica Split-Screen** | ⏳ Pendiente | Carga dinámica de pestañas de anexos y preguntas según la sección activa del trámite. Integración con `<PDFViewer>` y cache de sesión. |
| **3.3 Historial de Rondas y Anotaciones por Página** | ⏳ Pendiente | Bandeja de observaciones específicas por página del PDF (Anexo 12) y panel visual del histórico de observaciones de versiones de archivo anteriores. |
| **3.4 Disparadores de Acciones Especiales** | ⏳ Pendiente | Acciones programadas a mano: Carta de exención (Anexo 11), inhibición/reasignación por conflicto (Anexo 23), aprobación (Anexo 13) y suspensión (Anexo 26). |

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

