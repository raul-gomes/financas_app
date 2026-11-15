import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { queryKeys } from '@/lib/queryKeys';
import Settings from './Settings';

const mockGetProfile = vi.fn();
const mockListBanks = vi.fn();
const mockUpdateProfile = vi.fn();
const mockRemoveBank = vi.fn();
const mockSyncPluggy = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/settingsService', () => ({
  SettingsService: {
    getProfile: () => mockGetProfile(),
    listBanks: () => mockListBanks(),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    removeBank: (...args: unknown[]) => mockRemoveBank(...args),
    searchBrasilApi: vi.fn().mockResolvedValue([]),
    listPluggyAccounts: vi.fn().mockResolvedValue({ accounts: [], items: [] }),
    syncPluggy: () => mockSyncPluggy(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: true }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}));

const profile = {
  id: 1,
  name: 'Maria',
  email: 'maria@example.com',
  has_pluggy_key: false,
  role: 'user',
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const bank = { id: 7, bank_code: '341', bank_name: 'Banco Teste', created_at: '2026-01-01T00:00:00' };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProfile.mockResolvedValue(profile);
  mockListBanks.mockResolvedValue([bank]);
});

describe('Settings (react-query)', () => {
  it('preenche o formulário com o perfil e lista os bancos em cache', async () => {
    const { client } = renderWithQuery(<Settings />);

    await waitFor(() => expect((screen.getByPlaceholderText('Seu nome') as HTMLInputElement).value).toBe('Maria'));
    expect((screen.getByPlaceholderText('seu@email.com') as HTMLInputElement).value).toBe('maria@example.com');
    expect(screen.getByText('Banco Teste')).toBeTruthy();
    expect(client.getQueryData(queryKeys.settings.banks())).toEqual([bank]);
  });

  it('busca perfil e bancos uma única vez', async () => {
    renderWithQuery(<Settings />);
    await waitFor(() => expect(screen.getByText('Banco Teste')).toBeTruthy());

    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    expect(mockListBanks).toHaveBeenCalledTimes(1);
  });

  it('remove o banco e atualiza o cache sem nova busca', async () => {
    mockRemoveBank.mockResolvedValue(undefined);
    const { client } = renderWithQuery(<Settings />);
    await waitFor(() => expect(screen.getByText('Banco Teste')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Excluir banco' }));

    await waitFor(() => expect(screen.queryByText('Banco Teste')).toBeNull());
    expect(mockRemoveBank).toHaveBeenCalledWith(7);
    expect(client.getQueryData(queryKeys.settings.banks())).toEqual([]);
    expect(mockListBanks).toHaveBeenCalledTimes(1);
  });

  it('salva o nome e guarda o perfil devolvido no cache', async () => {
    mockUpdateProfile.mockResolvedValue({ ...profile, name: 'Maria Silva' });
    const { client } = renderWithQuery(<Settings />);
    await waitFor(() => expect((screen.getByPlaceholderText('Seu nome') as HTMLInputElement).value).toBe('Maria'));

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Maria Silva' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }));

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'Maria Silva' }));
    await waitFor(() =>
      expect(client.getQueryData<typeof profile>(queryKeys.settings.profile())?.name).toBe('Maria Silva'),
    );
  });

  it('avisa com um toast quando o carregamento falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetProfile.mockRejectedValue(new Error('falhou'));

    renderWithQuery(<Settings />);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Falha ao carregar configurações.' }),
      ),
    );
  });
});

describe('Settings - Pluggy sync result', () => {
  it('tells how many transactions were skipped and linked in the toast and the result box', async () => {
    mockGetProfile.mockResolvedValue({ ...profile, has_pluggy_key: true });
    mockSyncPluggy.mockResolvedValue({
      message: '4 transações importadas de 2 contas.',
      imported: 4,
      skipped: 12,
      linked: 3,
      accounts: 2,
    });
    renderWithQuery(<Settings />);
    const button = await screen.findByRole('button', { name: 'Sincronizar Transações' });
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);

    const expected =
      '4 transações importadas de 2 contas. 12 já estavam no app (3 vinculadas a lançamentos existentes).';
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sucesso', description: expected }));
  });
});
