export * from "react-native-web";
import {
  createElement,
  forwardRef,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type RefAttributes,
} from "react";
import {
  View as WebView,
  Switch as WebSwitch,
  Pressable as WebPressable,
} from "react-native-web";
import type { ViewProps, SwitchProps, PressableProps } from "react-native";
function webAccessibility(props: Pick<ViewProps, "accessibilityState">) {
  const state = props.accessibilityState;
  return {
    "aria-expanded": state?.expanded,
    "aria-checked": state?.checked,
    "aria-selected": state?.selected,
    "aria-disabled": state?.disabled,
    "aria-busy": state?.busy,
  };
}
export const Pressable = forwardRef<HTMLElement, PressableProps>((props, ref) =>
  createElement(
    WebPressable as unknown as ComponentType<
      PressableProps & RefAttributes<HTMLElement>
    >,
    { ...props, ...webAccessibility(props), ref },
  ),
);
// Native hidden-screen flags need DOM accessibility and keyboard equivalents.
export const View = forwardRef<HTMLElement, ViewProps>((props, ref) => {
  const node = useRef<HTMLElement | null>(null);
  const hidden =
    !!props.accessibilityElementsHidden ||
    props.importantForAccessibility === "no-hide-descendants";
  useLayoutEffect(() => {
    if (node.current) node.current.inert = hidden;
  }, [hidden]);
  return createElement(
    WebView as unknown as ComponentType<ViewProps & RefAttributes<HTMLElement>>,
    {
      ...props,
      ...webAccessibility(props),
      "aria-hidden": hidden || props["aria-hidden"],
      ref: (value: HTMLElement | null) => {
        node.current = value;
        if (typeof ref === "function") ref(value);
        else if (ref) ref.current = value;
      },
    },
  );
});
export const Switch = (props: SwitchProps) =>
  createElement(
    WebSwitch as unknown as ComponentType<
      SwitchProps & { activeThumbColor: SwitchProps["thumbColor"] }
    >,
    { ...props, activeThumbColor: props.thumbColor },
  );
const backListeners = new Set<() => boolean>();
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape")
    for (const listener of [...backListeners].reverse())
      if (listener()) {
        e.preventDefault();
        break;
      }
});
export const BackHandler = {
  addEventListener: (_event: string, listener: () => boolean) => {
    backListeners.add(listener);
    return {
      remove: () => {
        backListeners.delete(listener);
      },
    };
  },
};
export const Linking = {
  openURL: async (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  openSettings: async () => {
    window.dispatchEvent(new Event("crosswise-permissions"));
  },
};
export const Keyboard = {
  dismiss: () => {
    (document.activeElement as HTMLElement)?.blur?.();
  },
  addListener: (
    event: string,
    callback: (e: { endCoordinates: { screenY: number } }) => void,
  ) => {
    const handler = () => {
      const h = window.visualViewport?.height ?? innerHeight;
      if (event === "keyboardWillChangeFrame")
        callback({ endCoordinates: { screenY: h } });
      else if (h >= innerHeight - 50)
        callback({ endCoordinates: { screenY: h } });
    };
    window.visualViewport?.addEventListener("resize", handler);
    return {
      remove: () =>
        window.visualViewport?.removeEventListener("resize", handler),
    };
  },
};
