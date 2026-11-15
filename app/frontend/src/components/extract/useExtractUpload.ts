import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ExtractoService } from '@/services/extractService';
import type { SessionData } from '@/types/extract';

/**
 * Upload step: sends the chosen files to be parsed and hands the resulting sessions to
 * `onSessions` (already checked for duplicates by `prepareSessions`).
 */
export function useExtractUpload(
  prepareSessions: (sessions: SessionData[]) => Promise<SessionData[]>,
  onSessions: (sessions: SessionData[]) => void,
) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleFiles = async (selectedFiles: FileList | File[]) => {
    const files = Array.from(selectedFiles);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      setUploadProgress(`Processando ${files.length} arquivo${files.length > 1 ? 's' : ''}...`);
      const parsed = await ExtractoService.uploadMultiple(files);
      onSessions(await prepareSessions(parsed));
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao processar o extrato. Verifique o formato do arquivo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  return { isUploading, uploadProgress, handleFiles };
}
