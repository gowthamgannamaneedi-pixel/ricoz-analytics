import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Convert a Blob into a base64 encoded string
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result;
      // Strip off data:[<mediatype>];base64, prefix
      const base64 = typeof dataUrl === 'string' && dataUrl.includes(',') 
        ? dataUrl.split(',')[1] 
        : dataUrl;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal download helper supporting both Web browser downloads and Native Android Filesystem exports.
 * Preserves standard browser download behavior on desktop and mobile web, while cleanly writing to
 * device storage (Documents/Download) via Capacitor Filesystem on native Android.
 * 
 * Supports PDF, XLSX, CSV, JSON, and text formats.
 * 
 * @param {Blob|string} blob - File blob or text content
 * @param {string} filename - Filename with extension (e.g., report.pdf, data.xlsx, export.csv, report.json)
 * @returns {Promise<{ success: boolean, filename: string, uri?: string, path?: string }>}
 */
export async function downloadFileFromBlob(blob, filename) {
  if (!filename) {
    filename = `export_${Date.now()}`;
  }
  
  if (!(blob instanceof Blob)) {
    blob = new Blob([blob], { type: 'text/plain;charset=utf-8' });
  }

  // If running in Native Android or iOS Capacitor environment
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Save to native Documents directory
      const savedFile = await Filesystem.writeFile({
        path: sanitizedFilename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });

      // Dispatch event to show notification / toast
      window.dispatchEvent(new CustomEvent('native-file-downloaded', {
        detail: {
          filename: sanitizedFilename,
          uri: savedFile.uri || sanitizedFilename,
          path: savedFile.path || sanitizedFilename,
          status: 'success'
        }
      }));

      return {
        success: true,
        filename: sanitizedFilename,
        uri: savedFile.uri,
        path: savedFile.path
      };
    } catch (err) {
      console.warn('[NativeDownload] Error saving to Documents, trying Data directory fallback:', err);
      try {
        const base64Data = await blobToBase64(blob);
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedFile = await Filesystem.writeFile({
          path: sanitizedFilename,
          data: base64Data,
          directory: Directory.Data,
          recursive: true
        });

        window.dispatchEvent(new CustomEvent('native-file-downloaded', {
          detail: {
            filename: sanitizedFilename,
            uri: savedFile.uri || sanitizedFilename,
            status: 'success'
          }
        }));

        return {
          success: true,
          filename: sanitizedFilename,
          uri: savedFile.uri
        };
      } catch (fallbackErr) {
        console.error('[NativeDownload] Native filesystem save failed:', fallbackErr);
        window.dispatchEvent(new CustomEvent('native-file-downloaded', {
          detail: {
            filename,
            status: 'error',
            error: fallbackErr.message
          }
        }));
        throw fallbackErr;
      }
    }
  }

  // Standard Web Browser download flow
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 60000);

  return { success: true, filename };
}

