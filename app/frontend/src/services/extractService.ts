import {
  UploadResponse,
  ConfirmPayload,
  ConfirmResponse,
  SessionData,
} from '@/types/extract';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ExtractoService {
  static async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/extracts/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`Erro ${res.status} ao fazer upload do extrato`);
    return res.json();
  }

  static async uploadMultiple(files: File[]): Promise<SessionData[]> {
    if (files.length === 0) throw new Error('Nenhum arquivo selecionado');

    const results = await Promise.all(
      files.map(async (file) => {
        const response = await ExtractoService.upload(file);
        return {
          filename: file.name,
          bankCode: '',
          isConfirmed: false,
          transactions: response.transactions.map(t => ({
            ...t,
            category_id: undefined,
            subcategory_id: undefined,
            payment_method: t.payment_method || 'pix',
            entity_type: t.entity_type || 'individual',
          })),
        } as SessionData;
      })
    );

    return results;
  }

  static async confirm(payload: ConfirmPayload): Promise<ConfirmResponse> {
    const res = await fetch(`${API_BASE_URL}/extracts/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Erro ${res.status} ao confirmar extrato`);
    return res.json();
  }
}
