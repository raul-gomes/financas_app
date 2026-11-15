import { useRef } from 'react';
import { ArrowLeft, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtractUploadStepProps {
  isUploading: boolean;
  /** Progress text shown while the files are processed. */
  uploadProgress: string;
  onFilesSelected: (files: FileList | File[]) => void;
  onBack: () => void;
}

/** First step of the import: header with "Voltar" and the drop zone for CSV/OFX files. */
export function ExtractUploadStep({ isUploading, uploadProgress, onFilesSelected, onBack }: ExtractUploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files;
    if (dropped.length > 0) onFilesSelected(dropped);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="max-md:hidden">
            <h1 className="text-2xl font-bold text-foreground">Extrato Bancário</h1>
            <p className="text-muted-foreground mt-1">Importe seu extrato bancário em CSV ou OFX</p>
          </div>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
          onClick={() => !isUploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            id="file-input-extrato"
            type="file"
            accept=".csv,.ofx,.qfx"
            multiple
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files;
              if (selected && selected.length > 0) onFilesSelected(selected);
            }}
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <FileText className="w-12 h-12 text-muted-foreground animate-pulse" />
              <p className="text-lg text-muted-foreground">{uploadProgress || 'Processando...'}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Arraste os arquivos aqui ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, QFX (múltiplos arquivos)</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
