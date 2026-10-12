import { useStore } from "../state/store";
import { controller } from "../state/controller";
export function useCameraPermission() {
  return {
    hasPermission: useStore(controller.cameraPermission),
    canRequestPermission: true,
    requestPermission: () => controller.requestCamera(),
  };
}
