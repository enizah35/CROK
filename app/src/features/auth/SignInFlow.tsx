import { normalizeEmail } from '@crok/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { EmailForm } from './EmailForm';
import { sendCodeErrorMessage, verifyCodeErrorMessage } from './errors';
import { OtpCodeForm } from './OtpCodeForm';
import { supabase } from '@/lib/supabase';

/**
 * Connexion par code email (R-32) : email → signInWithOtp → code à 6 chiffres → verifyOtp.
 * Le même parcours sert à l'inscription (shouldCreateUser). Une fois le code validé, la garde
 * de navigation emmène vers l'onboarding ou l'app.
 */
export function SignInFlow() {
  const [email, setEmail] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState('');

  const sendCode = useMutation({
    mutationFn: async (address: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      return address;
    },
    onSuccess: (address) => setEmail(address),
  });

  const verifyCode = useMutation({
    mutationFn: async ({ address, token }: { address: string; token: string }) => {
      const { error } = await supabase.auth.verifyOtp({ email: address, token, type: 'email' });
      if (error) throw error;
    },
  });

  if (email === null) {
    return (
      <EmailForm
        initialEmail={sendCode.variables ?? draftEmail}
        busy={sendCode.isPending}
        error={sendCode.isError ? sendCodeErrorMessage(sendCode.error) : null}
        onSubmit={(raw) => sendCode.mutate(normalizeEmail(raw))}
      />
    );
  }

  const error = verifyCode.isError
    ? verifyCodeErrorMessage(verifyCode.error)
    : sendCode.isError
      ? sendCodeErrorMessage(sendCode.error)
      : null;

  return (
    <OtpCodeForm
      email={email}
      busy={verifyCode.isPending || sendCode.isPending}
      error={error}
      onSubmit={(token) => verifyCode.mutate({ address: email, token })}
      onResend={() => {
        verifyCode.reset();
        sendCode.mutate(email);
      }}
      onChangeEmail={() => {
        verifyCode.reset();
        sendCode.reset();
        setDraftEmail(email);
        setEmail(null);
      }}
    />
  );
}
