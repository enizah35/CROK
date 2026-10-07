import { Tabs } from 'expo-router';

import { CookResumePrompt } from '@/features/cook/CookResumePrompt';

export default function TabsLayout() {
  return (
    <>
      <Tabs>
        <Tabs.Screen name="recettes" options={{ title: 'Recettes' }} />
        <Tabs.Screen name="fil" options={{ title: 'Fil' }} />
        <Tabs.Screen name="classement" options={{ title: 'Classement' }} />
        <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
      </Tabs>
      {/* R-06 : à l'arrivée dans l'app, propose de reprendre une cuisson en cours. */}
      <CookResumePrompt />
    </>
  );
}
