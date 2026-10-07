import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="recettes" options={{ title: 'Recettes' }} />
      <Tabs.Screen name="fil" options={{ title: 'Fil' }} />
      <Tabs.Screen name="classement" options={{ title: 'Classement' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
