import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ModesScreen } from './src/screens/ModesScreen';
import { EditModeScreen } from './src/screens/EditModeScreen';
import { PaymentScreen } from './src/screens/PaymentScreen';
import UpdateChecker from './src/components/UpdateChecker';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Settings: undefined;
  Modes: undefined;
  EditMode: { modeId: string };
  Payment: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const TypeGoneTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#09090B',
    card: '#09090B',
    text: '#EAEAE8',
    border: '#1F1F25',
    primary: '#E8A83E',
  },
};

const screenOpts = {
  headerStyle: { backgroundColor: '#09090B' },
  headerTintColor: '#EAEAE8',
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
  headerShadowVisible: false,
};

function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E8A83E" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={TypeGoneTheme}>
      <Stack.Navigator screenOptions={screenOpts}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="Modes" component={ModesScreen} options={{ title: 'Voice Modes' }} />
            <Stack.Screen name="EditMode" component={EditModeScreen} options={{ title: 'Edit Mode' }} />
            <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Buy Credits' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UpdateChecker />
      <AppNavigator />
    </AuthProvider>
  );
}
