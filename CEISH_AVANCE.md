# Control de Avance — Prototipo Funcional CEISH

Este documento registra de forma detallada el progreso, las decisiones de diseño y las tareas completadas durante la implementación del prototipo funcional de la plataforma CEISH.

---

## 🎯 Objetivo General
Construir un prototipo funcional interactivo para la rama de investigaciones **"Sin Riesgo"** de la plataforma CEISH, implementando una capa de simulación de datos consistente a través de Zustand y localStorage, sin alterar la base de datos real (PostgreSQL/MinIO) ni los endpoints existentes del backend.

---

## 📅 Estado de las Tareas (Roadmap de Implementación)

### 🧱 Fase 1: Cimientos y Capa de Datos Simulada (Etapa 1)
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **1.1 Definición de Tipos** | ✅ Completado | Tipos de TypeScript agregados en [platform.types.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/types/platform.types.ts) |
| **1.2 Store de Simulación (Zustand + Storage)** | ✅ Completado | Store creado en [ceishStore.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/store/ceishStore.ts) con la clave `ceish-prototype-storage` y acción `resetearDatos`. |
| **1.3 Mapeo de Roles en Interfaz** | ✅ Completado | Labels visuales actualizados en [AppShell.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/components/AppShell.tsx) (Investigador, Revisor, Administrador). |

### 📝 Fase 2: Flujo del Investigador (Crear e Historial)
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **2.1 Formulario de Creación** | ✅ Completado | Formulario creado en [CrearInvestigacionModal.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/components/CrearInvestigacionModal.tsx) capturando título, descripción, co-autores, riesgo y conflictos. |
| **2.2 Historial del Investigador** | ✅ Completado | Vista de listado en [SubmissionPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/SubmissionPage.tsx) con código único, estado, timeline e integración con el cache temporal en memoria para archivos PDF. |

### 🔍 Fase 3: Flujo del Revisor (Estratificación - Etapa 1)
| Tarea | Estado | Descripción / Entregable |
|---|---|---|
| **3.1 Dashboard de Evaluador CEISH** | ⏳ Pendiente | Listado de investigaciones asignadas para estratificación (Revisión Ciega). |
| **3.2 Panel de Estratificación (Anexo 27)** | ⏳ Pendiente | Formulario del Anexo 27 interactivo al lado derecho del visor PDF. |
| **3.3 Resolución de Estratificación (Anexo 11 / 23)** | ⏳ Pendiente | Emisión del Anexo 11 (carta de exención) o Anexo 23 (darse de baja por conflicto). |

---

## 📝 Registro de Sesiones e Hilos de Trabajo

### Sesión 1: Alineación del Repositorio y Diseño del Plan
* **Fecha:** 2026-07-08
* **Actividades:**
  * Verificación directa en el código de los mecanismos de autenticación (sin JWT) y backend (Vite middleware).
  * Confirmación del esquema activo en PostgreSQL (`database/schema.sql`).
  * Clasificación de archivos legacy frente a los nuevos que se van a agregar.
  * Creación del archivo de seguimiento [CEISH_AVANCE.md](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/CEISH_AVANCE.md).
  * **Tarea 1.1 y 1.2 completadas:** Adición de tipos TypeScript específicos para CEISH en [platform.types.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/types/platform.types.ts) y creación del store de Zustand interactivo [ceishStore.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/store/ceishStore.ts) persistido con `localStorage`.
  * **Tarea 1.3 completada:** Labels visuales actualizados en [AppShell.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/components/AppShell.tsx) para mapear dinámicamente los roles ('Estudiante' -> 'Investigador', 'Evaluador' -> 'Revisor') y los ítems de navegación en el sidebar.
  * **Tarea 2.1 y 2.2 completadas:** Rediseño completo de la interfaz del Investigador en [SubmissionPage.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/SubmissionPage.tsx) para listar proyectos, ver su línea de tiempo, resoluciones emitidas y simular la subida segura de PDFs en cache de sesión ([fileCache.ts](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/store/fileCache.ts)). Creación del formulario de registro interactivo en [CrearInvestigacionModal.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/features/student/components/CrearInvestigacionModal.tsx).
  * **Botón de Reset del Prototipo:** Añadido botón físico de reinicio del estado del prototipo (icono de recarga amarillo) en la barra de usuario en [AppShell.tsx](file:///C:/Users/PC/Desktop/CHEISH%20Prototype/CEISH-PLATFORM-PROTOYPE/src/shared/components/AppShell.tsx).



