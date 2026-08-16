interface LockManager {
  request(name: string, callback: (lock: Lock) => Promise<any>): Promise<any>;
  request(
    name: string,
    options: { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean; signal?: AbortSignal },
    callback: (lock: Lock) => Promise<any>
  ): Promise<any>;
}
interface Lock {
  name: string;
  mode: 'exclusive' | 'shared';
}
interface Navigator {
  locks: LockManager;
}
interface Window {
  showOpenFilePicker(options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }): Promise<FileSystemFileHandle[]>;
}
interface FileSystemFileHandle {
  getFile(): Promise<File>;
}
