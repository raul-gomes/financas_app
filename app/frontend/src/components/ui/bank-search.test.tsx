import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BankSearchInput } from './bank-search';
import { SettingsService, type BrasilApiBank } from '@/services/settingsService';

vi.mock('@/services/settingsService', () => ({
  SettingsService: {
    searchBrasilApi: vi.fn(),
    addBank: vi.fn(),
  },
}));

const mockedService = vi.mocked(SettingsService);

const nuBank: BrasilApiBank = {
  code: '260',
  name: 'NUBANK',
  fullName: 'NU PAGAMENTOS S.A. - NUBANK',
  ispb: '00000000000000',
};

const createdBank = { id: 3, bank_code: '260', bank_name: 'NU PAGAMENTOS S.A. - NUBANK', created_at: '' };

describe('BankSearchInput', () => {
  beforeEach(() => {
    mockedService.searchBrasilApi.mockReset();
    mockedService.addBank.mockReset();
  });

  it('não busca com menos de 2 caracteres', async () => {
    render(<BankSearchInput />);
    const input = screen.getByPlaceholderText(/Digite o nome do banco/);
    fireEvent.change(input, { target: { value: 'n' } });
    await new Promise((r) => setTimeout(r, 350));
    expect(mockedService.searchBrasilApi).not.toHaveBeenCalled();
  });

  it('mostra os resultados da busca e adiciona via API ao clicar', async () => {
    const onBankAdded = vi.fn();
    mockedService.searchBrasilApi.mockResolvedValue([nuBank]);
    mockedService.addBank.mockResolvedValue(createdBank);

    render(<BankSearchInput onBankAdded={onBankAdded} />);
    const input = screen.getByPlaceholderText(/Digite o nome do banco/);
    fireEvent.change(input, { target: { value: 'nu' } });

    const result = await screen.findByRole('button', { name: /NU PAGAMENTOS/ });
    fireEvent.click(result);

    await waitFor(() => {
      expect(mockedService.searchBrasilApi).toHaveBeenCalledWith('nu');
      expect(mockedService.addBank).toHaveBeenCalledWith({
        bank_code: '260',
        bank_name: 'NU PAGAMENTOS S.A. - NUBANK',
      });
    });
    expect(onBankAdded).toHaveBeenCalledWith(expect.objectContaining({ bank_code: '260' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /NU PAGAMENTOS/ })).not.toBeInTheDocument();
    });
  });

  it('Enter adiciona o banco destacado no dropdown', async () => {
    mockedService.searchBrasilApi.mockResolvedValue([nuBank]);
    mockedService.addBank.mockResolvedValue(createdBank);

    render(<BankSearchInput />);
    const input = screen.getByPlaceholderText(/Digite o nome do banco/);
    fireEvent.change(input, { target: { value: 'nu' } });
    await screen.findByRole('button', { name: /NU PAGAMENTOS/ });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockedService.addBank).toHaveBeenCalled();
    });
  });
});