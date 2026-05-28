export interface StoredFile {
  filename: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  mimeType: string;
}

export interface StorageService {
  saveImage(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  deleteFile(filename: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
