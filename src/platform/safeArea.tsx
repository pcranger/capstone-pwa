import { View as WebView } from "react-native-web";
import type { ViewProps, View as NativeViewType } from "react-native";
const View = WebView as unknown as typeof NativeViewType;
export function SafeAreaView(props: ViewProps) {
  return <View {...props} />;
}
export function useSafeAreaInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
