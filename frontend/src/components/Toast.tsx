import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export const Toast = () => {
  const { toasts, closeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' ? CheckCircle : 
                   toast.type === 'warning' ? AlertTriangle : XCircle;
        
        const bgColor = toast.type === 'success' ? 'bg-green-50 border-green-200' :
                       toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                       'bg-red-50 border-red-200';
        
        const textColor = toast.type === 'success' ? 'text-green-800' :
                         toast.type === 'warning' ? 'text-yellow-800' :
                         'text-red-800';
        
        const iconColor = toast.type === 'success' ? 'text-green-400' :
                         toast.type === 'warning' ? 'text-yellow-400' :
                         'text-red-400';

        return (
          <div
            key={toast.id}
            className={`max-w-sm w-full ${bgColor} border rounded-lg shadow-lg p-4 flex items-start space-x-3`}
          >
            <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${textColor}`}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => closeToast(toast.id)}
              className={`${textColor} hover:opacity-75`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};