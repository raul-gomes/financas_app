import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const redirectTo = `${window.location.origin}/redefinir-senha`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-card border-none">
          <CardHeader>
            <CardTitle className="text-2xl text-center">E-mail enviado</CardTitle>
            <CardDescription className="text-center">
              Enviamos instruções para redefinir sua senha em <strong>{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Voltar para o login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-card border-none">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Esqueci minha senha</CardTitle>
          <CardDescription className="text-center">
            Informe seu e-mail e enviaremos um link para redefinição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Lembrou a senha?{' '}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}