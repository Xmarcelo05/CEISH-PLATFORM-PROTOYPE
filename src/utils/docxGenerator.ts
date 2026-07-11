import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export function generateDocx(templateBytes: Uint8Array, data: Record<string, any>, fileName: string) {
  try {
    const zip = new PizZip(templateBytes);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render variables
    doc.render(data);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Trigger browser download
    const url = window.URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating docx:", error);
    alert("Error al generar el documento de Word. Por favor verifique el formato de la plantilla.");
  }
}
