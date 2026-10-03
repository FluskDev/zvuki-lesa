import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TopBar() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-[#0E0E10]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">На главную</span>
        </button>
        <span className="text-white/60 text-sm">Звуки леса</span>
      </div>
    </header>
  );
}
