import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate('/login');
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-1">
      <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span>
    </Button>
  );
}