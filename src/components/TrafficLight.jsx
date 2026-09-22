import { AlertCircle } from 'lucide-react';

export default function TrafficLight({ percentage, size = 'md' }) {
  let color, status;
  
  if (percentage >= 95) {
    color = 'bg-green-500';
    status = 'Optimal';
  } else if (percentage >= 85) {
    color = 'bg-yellow-500';
    status = 'Warnung';
  } else {
    color = 'bg-red-500';
    status = 'Kritisch';
  }

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} ${color} rounded-full shadow-sm`} />
      <span className="text-xs text-slate-500">{status}</span>
    </div>
  );
}