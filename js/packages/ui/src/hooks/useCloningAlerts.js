
import { cloningActions } from '@opencloning/store/cloning';
import useAlerts from './useAlerts';

export default function useCloningAlerts() {
  return useAlerts({ actions: cloningActions });
}
