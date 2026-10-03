import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { adminLogin } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await adminLogin(password);
    setLoading(false);
    if (res.success) {
      navigate('/admin', { replace: true });
    } else {
      toast.error(res.error || 'Не удалось войти');
    }
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-[#141414] p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-lg font-semibold text-white">Вход в админку</h1>
        <Input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading ? 'Вход…' : 'Войти'}
        </Button>
      </form>
    </div>
  );
}