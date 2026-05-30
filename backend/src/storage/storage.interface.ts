export interface StoredFile {
  filename: string;
  url: string;
  thumbnailUrl: string;
  squareUrl: string;
  size: number;
  mimeType: string;
}

export interface StorageService {
  saveImage(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  deleteFile(filename: string): Promise<void>;
  resolveUrl(path: string): string;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
