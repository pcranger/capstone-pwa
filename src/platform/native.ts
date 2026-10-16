export * from "react-native-web";
import {
  createElement,
  forwardRef,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type RefAttributes,
  type KeyboardEventHandler,
} from "react";
import {
  View as WebView,
  Switch as WebSwitch,
  Pressable as WebPressable,
} from "react-native-web";
import type { ViewProps, SwitchProps, PressableProps, PressableStateCallbackType } from "react-native";
import { Colors } from '../ui/theme';
function webAccessibility(props: Pick<ViewProps, "accessibilityState" | "accessibilityRole" | "accessibilityLiveRegion" | "aria-live">) {
  const state = props.accessibilityState;
  return {
    "aria-expanded": state?.expanded,
    "aria-checked": state?.checked,
    "aria-selected": props.accessibilityRole === 'radio' || props.accessibilityRole === 'button' ? undefined : state?.selected,
    "aria-pressed": props.accessibilityRole === 'button' ? state?.selected : undefined,
    "aria-disabled": state?.disabled,
    "aria-busy": state?.busy,
    "aria-live": props['aria-live'] ?? (props.accessibilityLiveRegion === 'none' ? 'off' as const : props.accessibilityLiveRegion),
  };
}
export const Pressable = forwardRef<HTMLElement, PressableProps>((props, ref) => {
  // RN Web handles Space for buttons, but not for its switch/radio/tab roles.
  const customSpace = ['switch', 'radio', 'tab', 'checkbox'].includes(props.accessibilityRole ?? '');
  const onKeyDown: KeyboardEventHandler<HTMLElement> = event => {
    if (customSpace && event.key === ' ' && event.target === event.currentTarget) event.preventDefault();
  };
  const onKeyUp: KeyboardEventHandler<HTMLElement> = event => {
    if (customSpace && event.key === ' ' && event.target === event.currentTarget && !props.disabled && !props.accessibilityState?.disabled) {
      event.preventDefault(); event.currentTarget.click();
    }
  };
  return createElement(
    WebPressable as unknown as ComponentType<
      PressableProps & RefAttributes<HTMLElement> & { onKeyDown?: KeyboardEventHandler<HTMLElement>; onKeyUp?: KeyboardEventHandler<HTMLElement> }
    >,
    { ...props, ...webAccessibility(props), ...(props.accessible === false ? { 'aria-hidden': true, tabIndex: -1 } : {style: (state:PressableStateCallbackType) => [{backgroundColor:Colors.SurfaceVariant,borderWidth:1,borderColor:Colors.Hairline,paddingHorizontal:12,paddingVertical:8},typeof props.style==='function'?props.style(state):props.style,{borderRadius:14,minHeight:48}]}), onKeyDown, onKeyUp, ref },
  );
});
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
  if (e.key === "Escape" && !e.defaultPrevented)
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
