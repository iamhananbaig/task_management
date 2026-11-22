import type { AxiosResponse } from 'axios';

/** Save a blob response as a file, using the server's Content-Disposition name when present. */
export function saveDownload(res: AxiosResponse<Blob>, fallbackName: string): void {
  const name = /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
