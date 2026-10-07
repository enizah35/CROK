import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { SignInFlow } from '@/features/auth/SignInFlow';
import { Screen, useTheme } from '@/ui';

export default function ConnexionScreen() {
  const { spacing } = useTheme();
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={[styles.container, { padding: spacing.xl }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SignInFlow />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
});
