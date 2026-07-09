import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useBottomSheet } from '../../hooks';
import {
  DEFAULT_ACCESSIBILITY_HINT,
  DEFAULT_ACCESSIBILITY_LABEL,
  DEFAULT_ACCESSIBILITY_ROLE,
  DEFAULT_ACCESSIBLE,
  DEFAULT_APPEARS_ON_INDEX,
  DEFAULT_DISAPPEARS_ON_INDEX,
  DEFAULT_ENABLE_TOUCH_THROUGH,
  DEFAULT_OPACITY,
  DEFAULT_PRESS_BEHAVIOR,
} from './constants';
import { styles } from './styles';
import type { BottomSheetDefaultBackdropProps } from './types';

const BottomSheetBackdropComponent = ({
  animatedIndex,
  opacity: _providedOpacity,
  appearsOnIndex: _providedAppearsOnIndex,
  disappearsOnIndex: _providedDisappearsOnIndex,
  enableTouchThrough: _providedEnableTouchThrough,
  pressBehavior = DEFAULT_PRESS_BEHAVIOR,
  onPress,
  style,
  children,
  accessible: _providedAccessible = DEFAULT_ACCESSIBLE,
  accessibilityRole: _providedAccessibilityRole = DEFAULT_ACCESSIBILITY_ROLE,
  accessibilityLabel: _providedAccessibilityLabel = DEFAULT_ACCESSIBILITY_LABEL,
  accessibilityHint: _providedAccessibilityHint = DEFAULT_ACCESSIBILITY_HINT,
}: BottomSheetDefaultBackdropProps) => {
  //#region hooks
  const { snapToIndex, close } = useBottomSheet();
  const isMounted = useRef(false);
  //#endregion

  //#region defaults
  const opacity = _providedOpacity ?? DEFAULT_OPACITY;
  const appearsOnIndex = _providedAppearsOnIndex ?? DEFAULT_APPEARS_ON_INDEX;
  const disappearsOnIndex =
    _providedDisappearsOnIndex ?? DEFAULT_DISAPPEARS_ON_INDEX;
  const enableTouchThrough =
    _providedEnableTouchThrough ?? DEFAULT_ENABLE_TOUCH_THROUGH;
  //#endregion

  //#region variables
  const [pointerEvents, setPointerEvents] = useState<
    ViewProps['pointerEvents']
  >(enableTouchThrough ? 'none' : 'auto');
  //#endregion

  //#region callbacks
  const handleOnPress = useCallback(() => {
    onPress?.();

    if (pressBehavior === 'close') {
      close();
    } else if (pressBehavior === 'collapse') {
      snapToIndex(disappearsOnIndex as number);
    } else if (typeof pressBehavior === 'number') {
      snapToIndex(pressBehavior);
    }
  }, [snapToIndex, close, disappearsOnIndex, pressBehavior, onPress]);
  const handleContainerTouchability = useCallback(
    (shouldDisableTouchability: boolean) => {
      isMounted.current &&
        setPointerEvents(shouldDisableTouchability ? 'none' : 'auto');
    },
    []
  );
  //#endregion

  //#region tap gesture
  const tapHandler = useMemo(() => {
    const gesture = Gesture.Tap().onEnd(() => {
      runOnJS(handleOnPress)();
    });
    return gesture;
  }, [handleOnPress]);
  //#endregion

  //#region styles
  const containerAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        animatedIndex.value,
        [-1, disappearsOnIndex, appearsOnIndex],
        [0, 0, opacity],
        Extrapolation.CLAMP
      ),
    }),
    [animatedIndex, appearsOnIndex, disappearsOnIndex, opacity]
  );
  const containerStyle = useMemo(
    () => [
      StyleSheet.absoluteFill,
      styles.backdrop,
      style,
      containerAnimatedStyle,
    ],
    [style, containerAnimatedStyle]
  );
  //#endregion

  //#region effects
  // reanimated 4: 스프링/타이밍 정착값이 목표에 정확히 스냅되지 않아(-1 대신
  // -0.9999999720…) 강비교 `<= disappearsOnIndex`가 닫힘 상태에서 영구 false가 된다.
  // 그러면 닫힌 시트의 백드롭 pointerEvents가 'auto'로 고착되어 보이지 않는 전체화면
  // 뷰가 앱 전체 터치를 흡수한다(2026-07 RN 0.86 마이그레이션 터치 먹통 근본원인).
  // 스냅 인덱스는 정수 간격이므로 1e-3 완충은 실제 전이 판정과 충돌하지 않는다.
  useAnimatedReaction(
    () => animatedIndex.value <= disappearsOnIndex + 1e-3,
    (shouldDisableTouchability, previous) => {
      if (shouldDisableTouchability === previous) {
        return;
      }
      runOnJS(handleContainerTouchability)(shouldDisableTouchability);
    },
    [disappearsOnIndex]
  );

  // addressing updating the state after unmounting.
  // [link](https://github.com/gorhom/react-native-bottom-sheet/issues/1376)
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  //#endregion

  const AnimatedView = (
    <Animated.View
      style={containerStyle}
      pointerEvents={pointerEvents}
      accessible={_providedAccessible ?? undefined}
      accessibilityRole={_providedAccessibilityRole ?? undefined}
      accessibilityLabel={_providedAccessibilityLabel ?? undefined}
      accessibilityHint={
        _providedAccessibilityHint
          ? _providedAccessibilityHint
          : `Tap to ${
              typeof pressBehavior === 'string' ? pressBehavior : 'move'
            } the Bottom Sheet`
      }
    >
      {children}
    </Animated.View>
  );

  return pressBehavior !== 'none' ? (
    <GestureDetector gesture={tapHandler}>{AnimatedView}</GestureDetector>
  ) : (
    AnimatedView
  );
};

export const BottomSheetBackdrop = memo(BottomSheetBackdropComponent);
BottomSheetBackdrop.displayName = 'BottomSheetBackdrop';
