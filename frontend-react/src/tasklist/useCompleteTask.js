import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

/** Completes a task; maps the server's field errors back onto the react-hook-form fields. */
export function useCompleteTask(task, setError, onDone, successMessage = 'Task completed') {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (variables) => api(`/tasks/${task.key}/complete`, { method: 'POST', body: { variables } }),
    onSuccess: () => {
      toast(successMessage);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onDone?.();
    },
    onError: (e) => {
      Object.entries(e.fieldErrors || {}).forEach(([k, m]) => setError(k, { message: m }));
      toast(e.message, 'error');
    },
  });
}
