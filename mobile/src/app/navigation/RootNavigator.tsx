import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, Text, View } from 'react-native'
import { WalletScreen } from '../../modules/wallet/screens/WalletScreen'
import { LoginScreen } from '../../modules/auth/screens/LoginScreen'
import { RegisterScreen } from '../../modules/auth/screens/RegisterScreen'
import { useAuthSession } from '../../modules/auth/hooks/useAuthSession'
import type { ProtectedStackParamList, PublicStackParamList } from './types'

const PublicStack = createNativeStackNavigator<PublicStackParamList>()
const ProtectedStack = createNativeStackNavigator<ProtectedStackParamList>()

function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{name}</Text>
    </View>
  )
}

function PublicNavigator() {
  return (
    <PublicStack.Navigator screenOptions={{ headerShown: false }}>
      <PublicStack.Screen name="Login" component={LoginScreen} />
      <PublicStack.Screen name="Register" component={RegisterScreen} />
    </PublicStack.Navigator>
  )
}

function ProtectedNavigator() {
  return (
    <ProtectedStack.Navigator>
      <ProtectedStack.Screen name="Wallet" component={WalletScreen} />
      <ProtectedStack.Screen name="Transfer">
        {() => <PlaceholderScreen name="Transfer" />}
      </ProtectedStack.Screen>
    </ProtectedStack.Navigator>
  )
}

export function RootNavigator() {
  const { accessToken, isRestoringSession } = useAuthSession()

  if (isRestoringSession) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {accessToken ? <ProtectedNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  )
}
