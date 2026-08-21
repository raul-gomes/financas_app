import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BankSelect } from './bank-select';
import { SettingsService, type UserBank } from '@/services/settingsService';

vi.mock('@/services/settingsService', () => ({
  SettingsService: {
    listBanks: vi.fn(),
    addBank: vi.fn(),
  },
}));

const mockedService = vi.mocked(SettingsService);

const banks: UserBank[] = [
  { id: 1, bank_code: '260', bank_name: 'Nubank', created_at: '2026-01-01T00:00:00' },
  { id: 2, bank_code: '341', bank_name: 'Itaú', created_at: '2026-01-01T00:00:00' },
];

// O Radix Select responde a teclado de forma determinística no jsdom
// (pointer events são parcialmente stubados): Enter abre, setas navegam,
// Enter seleciona. Ao abrir, o trigger sai da árvore de acessibilidade,
// então capturamos o nó antes para continuar navegando.
describe('BankSelect', () => {
  beforeEach(() => {
    mockedService.listBanks.mockResolvedValue(banks);
    mockedService.addBank.mockReset();
  });

  const openSelect = (): HTMLElement => {
    const trigger = screen.getByRole('combobox');
    fireEvent.focus(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return trigger;
  };

  // O item em foco é quem trata Enter/Space no Radix Select.
  const selectOption = async (name: string | RegExp) => {
    const option = await screen.findByRole('option', { name });
    fireEvent.keyDown(option, { key: 'Enter' });
  };

  it('abre e lista os bancos do usuário com a opção +add', async () => {
    render(<BankSelect value={undefined} onValueChange={() => {}} />);

    await waitFor(() => expect(mockedService.listBanks).toHaveBeenCalled());
    openSelect();

    expect(await screen.findByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('Itaú')).toBeInTheDocument();
    expect(screen.getByText('Add new bank')).toBeInTheDocument();
  });

  it('seleciona um banco existente e propaga o código', async () => {
    const onValueChange = vi.fn();
    render(<BankSelect value={undefined} onValueChange={onValueChange} />);

    openSelect();
    await screen.findByText('Nubank');
    await selectOption(/Nubank/);

    expect(onValueChange).toHaveBeenCalledWith('260');
  });

  it('+add revela o mini-formulário de criação', async () => {
    render(<BankSelect value={undefined} onValueChange={() => {}} />);

    openSelect();
    await screen.findByText('Nubank');
    await selectOption(/Add new bank/);

    expect(await screen.findByPlaceholderText('Ex: 260')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Nubank')).toBeInTheDocument();
  });

  it('cria o banco via serviço, seleciona e fecha o formulário', async () => {
    const onValueChange = vi.fn();
    mockedService.addBank.mockResolvedValue({ id: 3, bank_code: '077', bank_name: 'Banco Inter', created_at: '2026-01-01T00:00:00' });

    render(<BankSelect value={undefined} onValueChange={onValueChange} />);

    openSelect();
    await screen.findByText('Nubank');
    await selectOption(/Add new bank/);
    fireEvent.change(await screen.findByPlaceholderText('Ex: 260'), { target: { value: '077' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Nubank'), { target: { value: 'Banco Inter' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(mockedService.addBank).toHaveBeenCalledWith({ bank_code: '077', bank_name: 'Banco Inter' });
    });
    expect(onValueChange).toHaveBeenCalledWith('077');
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Ex: 260')).not.toBeInTheDocument();
    });
  });

  it('valida campos vazios sem chamar o serviço', async () => {
    const onValueChange = vi.fn();
    render(<BankSelect value={undefined} onValueChange={onValueChange} />);

    openSelect();
    await screen.findByText('Nubank');
    await selectOption(/Add new bank/);
    await screen.findByPlaceholderText('Ex: 260');
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(mockedService.addBank).not.toHaveBeenCalled();
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('cancelar esconde o mini-formulário sem alterar a seleção', async () => {
    const onValueChange = vi.fn();
    render(<BankSelect value="260" onValueChange={onValueChange} />);

    openSelect();
    await screen.findByRole('option', { name: /Nubank/ });
    await selectOption(/Add new bank/);
    await screen.findByPlaceholderText('Ex: 260');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByPlaceholderText('Ex: 260')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
