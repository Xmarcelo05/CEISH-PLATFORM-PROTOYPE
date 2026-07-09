// Cache en memoria para almacenar los archivos PDF subidos durante la sesión activa.
// Esto evita la serialización binaria en localStorage (lo cual excedería el límite de 5MB)
// y permite al visor de PDF renderizar el archivo real si fue cargado en la sesión actual.
// Si la página se recarga, el cache se limpia y el visor mostrará un estado de fallback amigable.

export const ceishFileCache: Record<string, File> = {};
