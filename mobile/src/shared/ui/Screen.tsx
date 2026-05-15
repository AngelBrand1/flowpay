import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from './theme'

type ScreenProps = {
  children: React.ReactNode
  centered?: boolean
  keyboardAware?: boolean
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}

export function Screen({ children, centered, keyboardAware, style, contentStyle }: ScreenProps) {
  const behavior = Platform.OS === 'ios' ? 'padding' : 'height'

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      <KeyboardAvoidingView behavior={keyboardAware ? behavior : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.xl,
            },
            centered && { justifyContent: 'center' },
          ]}
          scrollEnabled={keyboardAware}
        >
          <View style={contentStyle}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
