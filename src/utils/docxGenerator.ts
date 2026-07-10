import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function generateDocx(templateBase64: string, data: Record<string, any>, fileName: string) {
  try {
    const content = base64ToUint8Array(templateBase64);
    const zip = new PizZip(content);
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
