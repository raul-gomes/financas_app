import { useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X, Loader2, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ExtractoService } from '@/services/extractService'
import type { SessionData } from '@/types/extract'

interface ExtratoUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: (sessions: SessionData[]) => void
}

export function ExtratoUploadModal({ open, onOpenChange, onUploadComplete }: ExtratoUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const { toast } = useToast()

  const handleFileSelect = async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles)
    if (fileArray.length === 0) return

    setIsUploading(true)
    try {
      setUploadProgress(`Processando ${fileArray.length} arquivo${fileArray.length > 1 ? 's' : ''}...`)
      const sessions = await ExtractoService.uploadMultiple(fileArray)
      onUploadComplete(sessions)
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Falha ao processar o extrato. Verifique o formato do arquivo.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) handleFileSelect(droppedFiles)
  }

  const handleClose = () => {
    if (!isUploading) onOpenChange(false)
  }

  return (
    <ResponsiveModal open={open} onOpenChange={handleClose} size="lg" title="Importar Extrato Bancário">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
          onClick={() => !isUploading && document.getElementById('file-input-extrato')?.click()}
        >
          <input
            id="file-input-extrato"
            type="file"
            accept=".csv,.ofx,.qfx"
            multiple
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files
              if (selected && selected.length > 0) handleFileSelect(selected)
            }}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg text-muted-foreground">{uploadProgress || 'Processando...'}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">
                Arraste os arquivos aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground">
                Formatos aceitos: CSV, OFX, QFX (múltiplos arquivos)
              </p>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="flex justify-center mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsUploading(false)
                setUploadProgress('')
              }}
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        )}
    </ResponsiveModal>
  )
}
